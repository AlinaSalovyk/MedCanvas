using MediatR;

namespace MedCanvas.Application.Features.TreatmentPlanning;

public sealed record CreateTreatmentPlanCommand(Guid PatientId, Guid SourceEncounterId) : IRequest<TreatmentPlanDto>;

public sealed record AddPlanItemCommand(
    Guid PlanId,
    Guid CatalogItemId,
    string? ToothFdi,
    string? Surface,
    string? Phase,
    int Quantity,
    string? Notes) : IRequest<TreatmentPlanDto>;

public sealed record RemovePlanItemCommand(Guid PlanId, Guid ItemId) : IRequest<TreatmentPlanDto>;

public sealed record SubmitTreatmentPlanCommand(Guid PlanId) : IRequest<TreatmentPlanDto>;

public sealed record ApproveTreatmentPlanCommand(Guid PlanId) : IRequest<TreatmentPlanDto>;

public sealed record CancelTreatmentPlanCommand(Guid PlanId) : IRequest<TreatmentPlanDto>;

public sealed record GetTreatmentPlanQuery(Guid PlanId) : IRequest<TreatmentPlanDto>;

public sealed record GetPatientTreatmentPlansQuery(Guid PatientId) : IRequest<IReadOnlyList<TreatmentPlanDto>>;
