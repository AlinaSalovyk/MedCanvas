using FluentValidation;
using MedCanvas.Application.Common.Exceptions;
using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Domain.Entities;
using MedCanvas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace MedCanvas.Application.Features.TreatmentExecution;

public sealed class RecordPerformedProcedureCommandHandler : IRequestHandler<RecordPerformedProcedureCommand, PerformedProcedureDto>
{
    private readonly IMedCanvasDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IDateTimeProvider _dateTimeProvider;
    private readonly IBillingWriteLock _writeLock;

    public RecordPerformedProcedureCommandHandler(
        IMedCanvasDbContext dbContext,
        ICurrentUserContext currentUserContext,
        IDateTimeProvider dateTimeProvider,
        IBillingWriteLock writeLock)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
        _dateTimeProvider = dateTimeProvider;
        _writeLock = writeLock;
    }

    public async Task<PerformedProcedureDto> Handle(RecordPerformedProcedureCommand request, CancellationToken cancellationToken)
    {
        if (!_currentUserContext.IsAuthenticated || _currentUserContext.ClinicId == null || _currentUserContext.UserId == null)
        {
            throw new UnauthorizedAccessException("Authenticated clinic context is required to record procedures.");
        }

        var clinicId = _currentUserContext.ClinicId.Value;
        var actorUserId = _currentUserContext.UserId.Value;
        var now = _dateTimeProvider.UtcNow;
        await using var transaction = await _writeLock.AcquireAsync(clinicId, cancellationToken);

        // FR-505: a retried request returns the original record instead of double-charging.
        var existing = await _dbContext.PerformedProcedures
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.ClinicId == clinicId && p.IdempotencyKey == request.IdempotencyKey.Trim(), cancellationToken);
        if (existing != null)
        {
            var requestedTooth = string.IsNullOrWhiteSpace(request.ToothFdi) ? null : request.ToothFdi.Trim();
            if (existing.EncounterId != request.EncounterId || existing.ProcedureCatalogItemId != request.CatalogItemId ||
                existing.TreatmentPlanItemId != request.TreatmentPlanItemId || existing.Quantity != request.Quantity ||
                (requestedTooth != null && existing.ToothFdi != requestedTooth) ||
                existing.ClinicalNote != request.ClinicalNote?.Trim())
            {
                throw new ConflictException("The operation key has already been used for a different performed procedure.");
            }
            return await ProjectAsync(_dbContext, existing, cancellationToken);
        }

        var encounter = await _dbContext.DentalEncounters
            .FirstOrDefaultAsync(e => e.Id == request.EncounterId && e.ClinicId == clinicId, cancellationToken);
        if (encounter == null)
        {
            throw new NotFoundException(nameof(DentalEncounter), request.EncounterId);
        }

        // FR-506/306: procedures are recorded on an open encounter only.
        if (encounter.Status != EncounterStatus.InProgress)
        {
            throw new Domain.Exceptions.DomainException(
                $"Encounter is '{encounter.Status}'; procedures can only be recorded on an encounter in progress.");
        }
        if (await _dbContext.Invoices.AnyAsync(i => i.ClinicId == clinicId && i.EncounterId == encounter.Id &&
            i.Status != InvoiceStatus.Voided, cancellationToken))
        {
            throw new ConflictException("The encounter's billable procedures are fixed by its active invoice. Void an unpaid invoice before recording more work, or start a new encounter.");
        }

        var catalogItem = await _dbContext.ProcedureCatalogItems
            .FirstOrDefaultAsync(i => i.Id == request.CatalogItemId && i.ClinicId == clinicId, cancellationToken);
        if (catalogItem == null)
        {
            throw new NotFoundException(nameof(ProcedureCatalogItem), request.CatalogItemId);
        }

        Guid? planItemId = null;
        TreatmentPlanItem? sourceItem = null;
        if (request.TreatmentPlanItemId.HasValue)
        {
            var plan = await _dbContext.TreatmentPlans
                .Include(p => p.Items)
                .FirstOrDefaultAsync(p =>
                    p.ClinicId == clinicId &&
                    p.Items.Any(i => i.Id == request.TreatmentPlanItemId.Value), cancellationToken);

            if (plan == null)
            {
                throw new NotFoundException(nameof(TreatmentPlan), request.TreatmentPlanItemId.Value);
            }

            if (plan.PatientId != encounter.PatientId)
            {
                // INV-003: a performed procedure cannot be charged to another patient's plan.
                throw new Domain.Exceptions.DomainException("The referenced plan item belongs to a different patient.");
            }

            sourceItem = plan.Items.Single(i => i.Id == request.TreatmentPlanItemId.Value);
            if (sourceItem.ProcedureCatalogItemId != catalogItem.Id || sourceItem.Quantity != request.Quantity ||
                (!string.IsNullOrWhiteSpace(request.ToothFdi) && sourceItem.ToothFdi != request.ToothFdi.Trim()))
            {
                throw new Domain.Exceptions.DomainException("Execution must match the approved plan item's procedure, tooth and quantity.");
            }
            if (await _dbContext.PerformedProcedures.AnyAsync(p => p.ClinicId == clinicId &&
                p.TreatmentPlanItemId == sourceItem.Id && p.Status == PerformedProcedureStatus.Recorded, cancellationToken))
            {
                throw new ConflictException("This plan item already has a recorded execution. Void the erroneous execution before correcting it.");
            }

            plan.MarkItemPerformed(request.TreatmentPlanItemId.Value, now);
            plan.NotifyExecutionStarted(now);
            planItemId = request.TreatmentPlanItemId;
        }

        var performed = PerformedProcedure.Record(
            clinicId,
            encounter.PatientId,
            encounter.Id,
            planItemId,
            catalogItem.Id,
            sourceItem?.ToothFdi ?? request.ToothFdi,
            request.Quantity,
            actorUserId,
            sourceItem?.UnitPriceSnapshot ?? catalogItem.DefaultPrice,
            request.ClinicalNote,
            request.IdempotencyKey,
            now);

        _dbContext.PerformedProcedures.Add(performed);

        _dbContext.ClinicalAuditEvents.Add(ClinicalAuditEvent.Create(
            clinicId,
            encounter.PatientId,
            encounter.Id,
            actorUserId,
            "PROCEDURE_PERFORMED",
            null,
            $"procedure:{performed.Id};catalog:{catalogItem.Code}",
            now));

        await _dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return await ProjectAsync(_dbContext, performed, cancellationToken);
    }

    internal static async Task<PerformedProcedureDto> ProjectAsync(
        IMedCanvasDbContext dbContext,
        PerformedProcedure performed,
        CancellationToken cancellationToken)
    {
        var catalogName = await dbContext.ProcedureCatalogItems
            .AsNoTracking()
            .Where(i => i.Id == performed.ProcedureCatalogItemId)
            .Select(i => i.Name)
            .FirstOrDefaultAsync(cancellationToken);

        var performerName = await dbContext.Users
            .AsNoTracking()
            .Where(u => u.Id == performed.PerformedByUserId)
            .Select(u => u.FullName)
            .FirstOrDefaultAsync(cancellationToken);

        return new PerformedProcedureDto(
            performed.Id,
            performed.ClinicId,
            performed.PatientId,
            performed.EncounterId,
            performed.TreatmentPlanItemId,
            performed.ProcedureCatalogItemId,
            catalogName ?? "?",
            performed.ToothFdi,
            performed.Quantity,
            performed.UnitPriceSnapshot,
            performed.TotalAmount,
            performed.ClinicalNote,
            performed.Status,
            performed.VoidReason,
            performed.PerformedByUserId,
            performerName ?? "?",
            performed.CreatedAtUtc);
    }
}

public sealed class RecordPerformedProcedureCommandValidator : AbstractValidator<RecordPerformedProcedureCommand>
{
    public RecordPerformedProcedureCommandValidator()
    {
        RuleFor(x => x.EncounterId).NotEmpty().WithMessage("Encounter identifier is required.");
        RuleFor(x => x.CatalogItemId).NotEmpty().WithMessage("Catalog item identifier is required.");
        RuleFor(x => x.IdempotencyKey)
            .NotEmpty().WithMessage("Idempotency key is required.")
            .MaximumLength(100).WithMessage("Idempotency key cannot exceed 100 characters.");
        RuleFor(x => x.Quantity).InclusiveBetween(1, 20).WithMessage("Quantity must be between 1 and 20.");
        RuleFor(x => x.ToothFdi)
            .Matches("^(?:[1-4][1-8]|5[1-5]|[6-8][1-5])$").WithMessage("Tooth FDI must be a valid ISO 3950 number.")
            .When(x => !string.IsNullOrWhiteSpace(x.ToothFdi));
        RuleFor(x => x.ClinicalNote).MaximumLength(1000).WithMessage("Clinical note cannot exceed 1000 characters.");
    }
}
