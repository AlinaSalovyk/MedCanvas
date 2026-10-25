using MediatR;

namespace MedCanvas.Application.Features.TreatmentExecution;

/// <summary>
/// Record a procedure the clinician actually performed (explicit action — INV-006).
/// Safe to retry: the idempotency key makes duplicate submissions return the original
/// record instead of creating a double charge (FR-505).
/// </summary>
public sealed record RecordPerformedProcedureCommand(
    Guid EncounterId,
    Guid CatalogItemId,
    string IdempotencyKey,
    string? ToothFdi = null,
    int Quantity = 1,
    string? ClinicalNote = null,
    Guid? TreatmentPlanItemId = null) : IRequest<PerformedProcedureDto>;

public sealed record VoidPerformedProcedureCommand(Guid PerformedProcedureId, string Reason) : IRequest<PerformedProcedureDto>;

public sealed record GetEncounterPerformedProceduresQuery(Guid EncounterId) : IRequest<IReadOnlyList<PerformedProcedureDto>>;

public sealed record GetPatientPerformedProceduresQuery(Guid PatientId) : IRequest<IReadOnlyList<PerformedProcedureDto>>;
