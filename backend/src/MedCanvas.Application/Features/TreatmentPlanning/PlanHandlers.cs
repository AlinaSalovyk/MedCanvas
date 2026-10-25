using FluentValidation;
using MedCanvas.Application.Common.Exceptions;
using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace MedCanvas.Application.Features.TreatmentPlanning;

internal static class PlanMapping
{
    public static TreatmentPlanDto ToDto(TreatmentPlan plan, IReadOnlyDictionary<Guid, string> catalogNames, DateTime createdAt, DateTime? updatedAt) =>
        new(
            plan.Id,
            plan.ClinicId,
            plan.PatientId,
            plan.SourceEncounterId,
            plan.Status,
            plan.Version,
            plan.ApprovedAtUtc,
            plan.EstimateTotal(),
            plan.Items.Select(i => new TreatmentPlanItemDto(
                i.Id,
                i.ProcedureCatalogItemId,
                catalogNames.GetValueOrDefault(i.ProcedureCatalogItemId, "?"),
                i.ToothFdi,
                i.Surface,
                i.Phase,
                i.Quantity,
                i.UnitPriceSnapshot,
                i.TotalAmount,
                i.Notes)).ToList(),
            createdAt,
            updatedAt);
}

public sealed class CreateTreatmentPlanCommandHandler : IRequestHandler<CreateTreatmentPlanCommand, TreatmentPlanDto>
{
    private readonly IMedCanvasDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IDateTimeProvider _dateTimeProvider;

    public CreateTreatmentPlanCommandHandler(IMedCanvasDbContext dbContext, ICurrentUserContext currentUserContext, IDateTimeProvider dateTimeProvider)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
        _dateTimeProvider = dateTimeProvider;
    }

    public async Task<TreatmentPlanDto> Handle(CreateTreatmentPlanCommand request, CancellationToken cancellationToken)
    {
        var plan = await PlanAccess.CreatePlanAsync(_dbContext, _currentUserContext, request.PatientId, request.SourceEncounterId, cancellationToken);
        _dbContext.TreatmentPlans.Add(plan);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return PlanMapping.ToDto(plan, new Dictionary<Guid, string>(), plan.CreatedAtUtc, plan.UpdatedAtUtc);
    }
}

public sealed class AddPlanItemCommandHandler : IRequestHandler<AddPlanItemCommand, TreatmentPlanDto>
{
    private readonly IMedCanvasDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IDateTimeProvider _dateTimeProvider;

    public AddPlanItemCommandHandler(IMedCanvasDbContext dbContext, ICurrentUserContext currentUserContext, IDateTimeProvider dateTimeProvider)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
        _dateTimeProvider = dateTimeProvider;
    }

    public async Task<TreatmentPlanDto> Handle(AddPlanItemCommand request, CancellationToken cancellationToken)
    {
        var (plan, _) = await PlanAccess.LoadPlanAsync(_dbContext, _currentUserContext, request.PlanId, includeItems: true, cancellationToken);

        // INV-001: the catalog item must belong to the plan's own clinic — foreign
        // procedures can never be slipped into a plan (404, no existence disclosure).
        var catalogItem = await _dbContext.ProcedureCatalogItems
            .FirstOrDefaultAsync(i => i.Id == request.CatalogItemId && i.ClinicId == plan.ClinicId, cancellationToken);
        if (catalogItem == null)
        {
            throw new NotFoundException(nameof(ProcedureCatalogItem), request.CatalogItemId);
        }

        var addedItem = plan.AddItem(catalogItem, request.ToothFdi, request.Surface, request.Phase, request.Quantity, request.Notes, _dateTimeProvider.UtcNow);

        // The domain adds to its internal collection; EF needs the new row declared
        // explicitly because the item carries a client-generated GUID key.
        _dbContext.TreatmentPlanItems.Add(addedItem);

        await _dbContext.SaveChangesAsync(cancellationToken);

        return await PlanAccess.ProjectAsync(_dbContext, plan, cancellationToken);
    }
}

public sealed class RemovePlanItemCommandHandler : IRequestHandler<RemovePlanItemCommand, TreatmentPlanDto>
{
    private readonly IMedCanvasDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IDateTimeProvider _dateTimeProvider;

    public RemovePlanItemCommandHandler(IMedCanvasDbContext dbContext, ICurrentUserContext currentUserContext, IDateTimeProvider dateTimeProvider)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
        _dateTimeProvider = dateTimeProvider;
    }

    public async Task<TreatmentPlanDto> Handle(RemovePlanItemCommand request, CancellationToken cancellationToken)
    {
        var (plan, _) = await PlanAccess.LoadPlanAsync(_dbContext, _currentUserContext, request.PlanId, includeItems: true, cancellationToken);
        plan.RemoveItem(request.ItemId, _dateTimeProvider.UtcNow);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return await PlanAccess.ProjectAsync(_dbContext, plan, cancellationToken);
    }
}

public sealed class SubmitTreatmentPlanCommandHandler : IRequestHandler<SubmitTreatmentPlanCommand, TreatmentPlanDto>
{
    private readonly IMedCanvasDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IDateTimeProvider _dateTimeProvider;

    public SubmitTreatmentPlanCommandHandler(IMedCanvasDbContext dbContext, ICurrentUserContext currentUserContext, IDateTimeProvider dateTimeProvider)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
        _dateTimeProvider = dateTimeProvider;
    }

    public async Task<TreatmentPlanDto> Handle(SubmitTreatmentPlanCommand request, CancellationToken cancellationToken)
    {
        var (plan, _) = await PlanAccess.LoadPlanAsync(_dbContext, _currentUserContext, request.PlanId, includeItems: true, cancellationToken);
        plan.SubmitForApproval(_dateTimeProvider.UtcNow);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return await PlanAccess.ProjectAsync(_dbContext, plan, cancellationToken);
    }
}

public sealed class ApproveTreatmentPlanCommandHandler : IRequestHandler<ApproveTreatmentPlanCommand, TreatmentPlanDto>
{
    private readonly IMedCanvasDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IDateTimeProvider _dateTimeProvider;

    public ApproveTreatmentPlanCommandHandler(IMedCanvasDbContext dbContext, ICurrentUserContext currentUserContext, IDateTimeProvider dateTimeProvider)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
        _dateTimeProvider = dateTimeProvider;
    }

    public async Task<TreatmentPlanDto> Handle(ApproveTreatmentPlanCommand request, CancellationToken cancellationToken)
    {
        var (plan, actor) = await PlanAccess.LoadPlanAsync(_dbContext, _currentUserContext, request.PlanId, includeItems: true, cancellationToken);
        plan.Approve(actor, _dateTimeProvider.UtcNow);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return await PlanAccess.ProjectAsync(_dbContext, plan, cancellationToken);
    }
}

public sealed class CancelTreatmentPlanCommandHandler : IRequestHandler<CancelTreatmentPlanCommand, TreatmentPlanDto>
{
    private readonly IMedCanvasDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IDateTimeProvider _dateTimeProvider;

    public CancelTreatmentPlanCommandHandler(IMedCanvasDbContext dbContext, ICurrentUserContext currentUserContext, IDateTimeProvider dateTimeProvider)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
        _dateTimeProvider = dateTimeProvider;
    }

    public async Task<TreatmentPlanDto> Handle(CancelTreatmentPlanCommand request, CancellationToken cancellationToken)
    {
        var (plan, _) = await PlanAccess.LoadPlanAsync(_dbContext, _currentUserContext, request.PlanId, includeItems: true, cancellationToken);
        plan.Cancel(_dateTimeProvider.UtcNow);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return await PlanAccess.ProjectAsync(_dbContext, plan, cancellationToken);
    }
}

public sealed class GetTreatmentPlanQueryHandler : IRequestHandler<GetTreatmentPlanQuery, TreatmentPlanDto>
{
    private readonly IMedCanvasDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;

    public GetTreatmentPlanQueryHandler(IMedCanvasDbContext dbContext, ICurrentUserContext currentUserContext)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
    }

    public async Task<TreatmentPlanDto> Handle(GetTreatmentPlanQuery request, CancellationToken cancellationToken)
    {
        var (plan, _) = await PlanAccess.LoadPlanAsync(_dbContext, _currentUserContext, request.PlanId, includeItems: true, cancellationToken);
        return await PlanAccess.ProjectAsync(_dbContext, plan, cancellationToken);
    }
}

public sealed class GetPatientTreatmentPlansQueryHandler : IRequestHandler<GetPatientTreatmentPlansQuery, IReadOnlyList<TreatmentPlanDto>>
{
    private readonly IMedCanvasDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;

    public GetPatientTreatmentPlansQueryHandler(IMedCanvasDbContext dbContext, ICurrentUserContext currentUserContext)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
    }

    public async Task<IReadOnlyList<TreatmentPlanDto>> Handle(GetPatientTreatmentPlansQuery request, CancellationToken cancellationToken)
    {
        if (!_currentUserContext.IsAuthenticated || _currentUserContext.ClinicId == null)
        {
            throw new UnauthorizedAccessException("Authenticated clinic context is required.");
        }

        var clinicId = _currentUserContext.ClinicId.Value;

        var plans = await _dbContext.TreatmentPlans
            .AsNoTracking()
            .Include(p => p.Items)
            .Where(p => p.ClinicId == clinicId && p.PatientId == request.PatientId)
            .OrderByDescending(p => p.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        var result = new List<TreatmentPlanDto>(plans.Count);
        foreach (var plan in plans)
        {
            result.Add(await PlanAccess.ProjectAsync(_dbContext, plan, cancellationToken));
        }

        return result;
    }
}

internal static class PlanAccess
{
    public static async Task<TreatmentPlan> CreatePlanAsync(
        IMedCanvasDbContext dbContext,
        ICurrentUserContext currentUserContext,
        Guid patientId,
        Guid sourceEncounterId,
        CancellationToken cancellationToken)
    {
        if (!currentUserContext.IsAuthenticated || currentUserContext.ClinicId == null || currentUserContext.UserId == null)
        {
            throw new UnauthorizedAccessException("Authenticated clinic context is required.");
        }

        var clinicId = currentUserContext.ClinicId.Value;

        var patient = await dbContext.Patients
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == patientId && p.ClinicId == clinicId, cancellationToken);
        if (patient == null)
        {
            throw new NotFoundException(nameof(Patient), patientId);
        }

        var encounter = await dbContext.DentalEncounters
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.Id == sourceEncounterId && e.ClinicId == clinicId, cancellationToken);
        if (encounter == null)
        {
            throw new NotFoundException(nameof(DentalEncounter), sourceEncounterId);
        }

        if (encounter.PatientId != patient.Id)
        {
            // INV-003: a plan cannot be anchored to an encounter of another patient.
            throw new Common.Exceptions.ConflictException("The source encounter belongs to a different patient.");
        }

        return TreatmentPlan.Create(clinicId, patient.Id, sourceEncounterId, currentUserContext.UserId.Value, DateTime.UtcNow);
    }

    public static async Task<(TreatmentPlan Plan, Guid ActorUserId)> LoadPlanAsync(
        IMedCanvasDbContext dbContext,
        ICurrentUserContext currentUserContext,
        Guid planId,
        bool includeItems,
        CancellationToken cancellationToken)
    {
        if (!currentUserContext.IsAuthenticated || currentUserContext.ClinicId == null || currentUserContext.UserId == null)
        {
            throw new UnauthorizedAccessException("Authenticated clinic context is required.");
        }

        var query = dbContext.TreatmentPlans.AsQueryable();
        if (includeItems)
        {
            query = query.Include(p => p.Items);
        }

        var plan = await query
            .FirstOrDefaultAsync(p => p.Id == planId && p.ClinicId == currentUserContext.ClinicId.Value, cancellationToken);

        if (plan == null)
        {
            throw new NotFoundException(nameof(TreatmentPlan), planId);
        }

        return (plan, currentUserContext.UserId.Value);
    }

    public static async Task<TreatmentPlanDto> ProjectAsync(IMedCanvasDbContext dbContext, TreatmentPlan plan, CancellationToken cancellationToken)
    {
        var catalogIds = plan.Items.Select(i => i.ProcedureCatalogItemId).Distinct().ToList();
        var names = await dbContext.ProcedureCatalogItems
            .AsNoTracking()
            .Where(i => catalogIds.Contains(i.Id))
            .ToDictionaryAsync(i => i.Id, i => i.Name, cancellationToken);

        return PlanMapping.ToDto(plan, names, plan.CreatedAtUtc, plan.UpdatedAtUtc);
    }
}

public sealed class CreateTreatmentPlanCommandValidator : AbstractValidator<CreateTreatmentPlanCommand>
{
    public CreateTreatmentPlanCommandValidator()
    {
        RuleFor(x => x.PatientId).NotEmpty().WithMessage("Patient identifier is required.");
        RuleFor(x => x.SourceEncounterId).NotEmpty().WithMessage("Source encounter identifier is required.");
    }
}

public sealed class AddPlanItemCommandValidator : AbstractValidator<AddPlanItemCommand>
{
    public AddPlanItemCommandValidator()
    {
        RuleFor(x => x.PlanId).NotEmpty().WithMessage("Plan identifier is required.");
        RuleFor(x => x.CatalogItemId).NotEmpty().WithMessage("Catalog item identifier is required.");
        RuleFor(x => x.Quantity).InclusiveBetween(1, 20).WithMessage("Quantity must be between 1 and 20.");
        RuleFor(x => x.Phase).MaximumLength(100).WithMessage("Phase cannot exceed 100 characters.");
        RuleFor(x => x.Notes).MaximumLength(500).WithMessage("Notes cannot exceed 500 characters.");
    }
}
