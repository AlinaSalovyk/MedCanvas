using FluentValidation;
using MedCanvas.Application.Common.Exceptions;
using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Domain.Entities;
using MedCanvas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace MedCanvas.Application.Features.Billing;

internal static class BillingMapping
{
    public static async Task<InvoiceDto> ProjectAsync(IMedCanvasDbContext dbContext, Invoice invoice, CancellationToken cancellationToken)
    {
        var patientName = await dbContext.Patients
            .AsNoTracking()
            .Where(p => p.Id == invoice.PatientId)
            .Select(p => p.FullName)
            .FirstOrDefaultAsync(cancellationToken) ?? "?";

        var recorderIds = invoice.Payments.Select(p => p.RecordedByUserId).Distinct().ToList();
        var recorderNames = await dbContext.Users
            .AsNoTracking()
            .Where(u => recorderIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.FullName, cancellationToken);

        return new InvoiceDto(
            invoice.Id,
            invoice.ClinicId,
            invoice.PatientId,
            patientName,
            invoice.EncounterId,
            invoice.InvoiceNumber,
            invoice.TotalAmount,
            invoice.Currency,
            invoice.Status,
            invoice.SimulatedPaid(),
            invoice.RemainingBalance(),
            invoice.IsDemo,
            invoice.Items
                .OrderBy(p => p.PerformedProcedureId)
                .Select(p => new InvoiceLineDto(
                    p.PerformedProcedureId,
                    p.DescriptionSnapshot,
                    p.ToothFdi,
                    p.Quantity,
                    p.UnitPriceSnapshot,
                    p.TotalAmount))
                .ToList(),
            invoice.Payments
                .Select(p => new SimulatedPaymentDto(
                    p.Id,
                    p.Amount,
                    p.MethodLabel,
                    p.Status,
                    p.VoidReason,
                    recorderNames.GetValueOrDefault(p.RecordedByUserId, "?"),
                    p.CreatedAtUtc))
                .ToList(),
            invoice.CreatedAtUtc,
            invoice.UpdatedAtUtc,
            invoice.HasLineSnapshot);
    }
}

public sealed class CreateInvoiceFromEncounterCommandHandler : IRequestHandler<CreateInvoiceFromEncounterCommand, InvoiceDto>
{
    private readonly IBillingWriteLock _writeLock;
    private readonly IMedCanvasDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IDateTimeProvider _dateTimeProvider;

    public CreateInvoiceFromEncounterCommandHandler(
        IMedCanvasDbContext dbContext,
        ICurrentUserContext currentUserContext,
        IDateTimeProvider dateTimeProvider,
        IBillingWriteLock writeLock)
    {
        _writeLock = writeLock;
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
        _dateTimeProvider = dateTimeProvider;
    }

    public async Task<InvoiceDto> Handle(CreateInvoiceFromEncounterCommand request, CancellationToken cancellationToken)
    {
        if (!_currentUserContext.IsAuthenticated || _currentUserContext.ClinicId == null || _currentUserContext.UserId == null)
        {
            throw new UnauthorizedAccessException("Authenticated clinic context is required to issue invoices.");
        }

        var clinicId = _currentUserContext.ClinicId.Value;
        await using var transaction = await _writeLock.AcquireAsync(clinicId, cancellationToken);

        var encounter = await _dbContext.DentalEncounters
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.Id == request.EncounterId && e.ClinicId == clinicId, cancellationToken);
        if (encounter == null)
        {
            throw new NotFoundException(nameof(DentalEncounter), request.EncounterId);
        }

        // FR-601/602: only non-voided recorded procedures of THIS encounter; the server
        // computes the total. Already invoiced procedures are never billed twice.
        var alreadyInvoiced = await _dbContext.Invoices
            .AsNoTracking()
            .AnyAsync(i => i.ClinicId == clinicId && i.EncounterId == encounter.Id && i.Status != InvoiceStatus.Voided, cancellationToken);
        if (alreadyInvoiced)
        {
            throw new ConflictException("The encounter already has an active invoice. Void an unpaid invoice before reissuing.");
        }

        var procedures = await _dbContext.PerformedProcedures
            .AsNoTracking()
            .Where(p => p.ClinicId == clinicId && p.EncounterId == encounter.Id && p.Status == PerformedProcedureStatus.Recorded)
            .ToListAsync(cancellationToken);

        var billableTotal = procedures.Sum(p => p.TotalAmount);
        if (billableTotal <= 0)
        {
            throw new Common.Exceptions.ConflictException("The encounter has no billable recorded procedures.");
        }

        var catalogIds = procedures.Select(p => p.ProcedureCatalogItemId).Distinct().ToList();
        var catalog = await _dbContext.ProcedureCatalogItems.AsNoTracking()
            .Where(c => c.ClinicId == clinicId && catalogIds.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, cancellationToken);
        var invoiceNumber = $"INV-{Guid.NewGuid():N}";
        var invoice = Invoice.Issue(clinicId, encounter.PatientId, encounter.Id, invoiceNumber, procedures, catalog, _currentUserContext.UserId.Value, _dateTimeProvider.UtcNow);

        _dbContext.Invoices.Add(invoice);

        _dbContext.ClinicalAuditEvents.Add(ClinicalAuditEvent.Create(
            clinicId,
            encounter.PatientId,
            encounter.Id,
            _currentUserContext.UserId.Value,
            "INVOICE_ISSUED",
            null,
            $"invoice:{invoice.Id};total:{invoice.TotalAmount}",
            _dateTimeProvider.UtcNow));

        await _dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return await BillingMapping.ProjectAsync(_dbContext, invoice, cancellationToken);
    }
}

public sealed class RegisterSimulatedPaymentCommandHandler : IRequestHandler<RegisterSimulatedPaymentCommand, InvoiceDto>
{
    private readonly IBillingWriteLock _writeLock;
    private readonly IMedCanvasDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IDateTimeProvider _dateTimeProvider;

    public RegisterSimulatedPaymentCommandHandler(
        IMedCanvasDbContext dbContext,
        ICurrentUserContext currentUserContext,
        IDateTimeProvider dateTimeProvider,
        IBillingWriteLock writeLock)
    {
        _writeLock = writeLock;
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
        _dateTimeProvider = dateTimeProvider;
    }

    public async Task<InvoiceDto> Handle(RegisterSimulatedPaymentCommand request, CancellationToken cancellationToken)
    {
        if (!_currentUserContext.IsAuthenticated || _currentUserContext.ClinicId == null || _currentUserContext.UserId == null)
        {
            throw new UnauthorizedAccessException("Authenticated clinic context is required to register simulated payments.");
        }

        var clinicId = _currentUserContext.ClinicId.Value;
        await using var transaction = await _writeLock.AcquireAsync(clinicId, cancellationToken);

        // FR-607: a retried request does not create a duplicate payment record.
        var existingPayment = await _dbContext.SimulatedPayments
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.ClinicId == clinicId && p.IdempotencyKey == request.IdempotencyKey.Trim(), cancellationToken);
        if (existingPayment != null)
        {
            if (existingPayment.InvoiceId != request.InvoiceId || existingPayment.Amount != request.Amount ||
                existingPayment.MethodLabel != request.MethodLabel.Trim())
            {
                throw new ConflictException("The idempotency key has already been used for a different simulated payment.");
            }
            var existingInvoice = await _dbContext.Invoices
                .AsNoTracking()
                .Include(i => i.Payments)
                .FirstAsync(i => i.Id == existingPayment.InvoiceId, cancellationToken);
            return await BillingMapping.ProjectAsync(_dbContext, existingInvoice, cancellationToken);
        }

        var invoice = await _dbContext.Invoices
            .Include(i => i.Payments)
            .FirstOrDefaultAsync(i => i.Id == request.InvoiceId && i.ClinicId == clinicId, cancellationToken);
        if (invoice == null)
        {
            throw new NotFoundException(nameof(Invoice), request.InvoiceId);
        }
        if (!invoice.HasLineSnapshot)
        {
            throw new ConflictException("This legacy invoice has no verifiable historical line snapshot. Financial review is required before further payments.");
        }

        var payment = SimulatedPayment.Record(
            clinicId,
            invoice.Id,
            request.Amount,
            request.MethodLabel,
            request.IdempotencyKey,
            _currentUserContext.UserId.Value,
            _dateTimeProvider.UtcNow);

        // The database lock precedes all reads and remains held through the atomic
        // payment, invoice status and audit commit (including retries and voids).
        invoice.AddSimulatedPayment(payment, _dateTimeProvider.UtcNow);

        _dbContext.SimulatedPayments.Add(payment);

        _dbContext.ClinicalAuditEvents.Add(ClinicalAuditEvent.Create(
            clinicId,
            invoice.PatientId,
            invoice.EncounterId,
            _currentUserContext.UserId.Value,
            "SIMULATED_PAYMENT_RECORDED",
            null,
            $"invoice:{invoice.Id};amount:{payment.Amount}",
            _dateTimeProvider.UtcNow));

        await _dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return await BillingMapping.ProjectAsync(_dbContext, invoice, cancellationToken);
    }
}

public sealed class VoidInvoiceCommandHandler : IRequestHandler<VoidInvoiceCommand, InvoiceDto>
{
    private readonly IBillingWriteLock _writeLock;
    private readonly IMedCanvasDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IDateTimeProvider _dateTimeProvider;

    public VoidInvoiceCommandHandler(IMedCanvasDbContext dbContext, ICurrentUserContext currentUserContext, IDateTimeProvider dateTimeProvider, IBillingWriteLock writeLock)
    {
        _writeLock = writeLock;
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
        _dateTimeProvider = dateTimeProvider;
    }

    public async Task<InvoiceDto> Handle(VoidInvoiceCommand request, CancellationToken cancellationToken)
    {
        if (!_currentUserContext.IsAuthenticated || _currentUserContext.ClinicId == null || _currentUserContext.UserId == null)
        {
            throw new UnauthorizedAccessException("Authenticated clinic context is required.");
        }

        await using var transaction = await _writeLock.AcquireAsync(_currentUserContext.ClinicId.Value, cancellationToken);
        var invoice = await _dbContext.Invoices
            .Include(i => i.Payments)
            .FirstOrDefaultAsync(i => i.Id == request.InvoiceId && i.ClinicId == _currentUserContext.ClinicId.Value, cancellationToken);
        if (invoice == null)
        {
            throw new NotFoundException(nameof(Invoice), request.InvoiceId);
        }

        invoice.Void(request.Reason, _currentUserContext.UserId.Value, _dateTimeProvider.UtcNow);

        _dbContext.ClinicalAuditEvents.Add(ClinicalAuditEvent.Create(
            invoice.ClinicId,
            invoice.PatientId,
            invoice.EncounterId,
            _currentUserContext.UserId.Value,
            "INVOICE_VOIDED",
            null,
            $"invoice:{invoice.Id}",
            _dateTimeProvider.UtcNow));

        await _dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return await BillingMapping.ProjectAsync(_dbContext, invoice, cancellationToken);
    }
}

public sealed class GetInvoiceQueryHandler : IRequestHandler<GetInvoiceQuery, InvoiceDto>
{
    private readonly IMedCanvasDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;

    public GetInvoiceQueryHandler(IMedCanvasDbContext dbContext, ICurrentUserContext currentUserContext)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
    }

    public async Task<InvoiceDto> Handle(GetInvoiceQuery request, CancellationToken cancellationToken)
    {
        if (!_currentUserContext.IsAuthenticated || _currentUserContext.ClinicId == null)
        {
            throw new UnauthorizedAccessException("Authenticated clinic context is required.");
        }

        var invoice = await _dbContext.Invoices
            .AsNoTracking()
            .Include(i => i.Payments)
            .FirstOrDefaultAsync(i => i.Id == request.InvoiceId && i.ClinicId == _currentUserContext.ClinicId.Value, cancellationToken);
        if (invoice == null)
        {
            throw new NotFoundException(nameof(Invoice), request.InvoiceId);
        }

        return await BillingMapping.ProjectAsync(_dbContext, invoice, cancellationToken);
    }
}

public sealed class GetPatientInvoicesQueryHandler : IRequestHandler<GetPatientInvoicesQuery, IReadOnlyList<InvoiceDto>>
{
    private readonly IMedCanvasDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;

    public GetPatientInvoicesQueryHandler(IMedCanvasDbContext dbContext, ICurrentUserContext currentUserContext)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
    }

    public async Task<IReadOnlyList<InvoiceDto>> Handle(GetPatientInvoicesQuery request, CancellationToken cancellationToken)
    {
        if (!_currentUserContext.IsAuthenticated || _currentUserContext.ClinicId == null)
        {
            throw new UnauthorizedAccessException("Authenticated clinic context is required.");
        }

        var invoices = await _dbContext.Invoices
            .AsNoTracking()
            .Include(i => i.Payments)
            .Where(i => i.ClinicId == _currentUserContext.ClinicId.Value && i.PatientId == request.PatientId)
            .OrderByDescending(i => i.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        var result = new List<InvoiceDto>(invoices.Count);
        foreach (var invoice in invoices)
        {
            result.Add(await BillingMapping.ProjectAsync(_dbContext, invoice, cancellationToken));
        }

        return result;
    }
}

public sealed class RegisterSimulatedPaymentCommandValidator : AbstractValidator<RegisterSimulatedPaymentCommand>
{
    public RegisterSimulatedPaymentCommandValidator()
    {
        RuleFor(x => x.InvoiceId).NotEmpty().WithMessage("Invoice identifier is required.");
        RuleFor(x => x.Amount)
            .GreaterThan(0).WithMessage("Simulated payment amount must be positive.")
            .Must(amount => decimal.Round(amount, 2) == amount).WithMessage("Use at most two decimal places.")
            .LessThanOrEqualTo(999_999).WithMessage("Simulated payment amount cannot exceed 999 999 UAH.");
        RuleFor(x => x.MethodLabel)
            .NotEmpty().WithMessage("Method label is required.")
            .MaximumLength(100).WithMessage("Method label cannot exceed 100 characters.");
        RuleFor(x => x.IdempotencyKey)
            .NotEmpty().WithMessage("Idempotency key is required.")
            .MaximumLength(100).WithMessage("Idempotency key cannot exceed 100 characters.");
    }
}

public sealed class VoidInvoiceCommandValidator : AbstractValidator<VoidInvoiceCommand>
{
    public VoidInvoiceCommandValidator()
    {
        RuleFor(x => x.InvoiceId).NotEmpty().WithMessage("Invoice identifier is required.");
        RuleFor(x => x.Reason)
            .NotEmpty().WithMessage("Void reason is required.")
            .MaximumLength(500).WithMessage("Void reason cannot exceed 500 characters.");
    }
}
