using MedCanvas.Domain.Enums;

namespace MedCanvas.Application.Features.TreatmentPlanning;

public sealed record CatalogItemDto(
    Guid Id,
    Guid ClinicId,
    string Code,
    string Name,
    string? Description,
    string? Category,
    decimal DefaultPrice,
    int EstimatedDurationMinutes,
    bool IsActive);

public sealed record TreatmentPlanItemDto(
    Guid Id,
    Guid ProcedureCatalogItemId,
    string CatalogItemName,
    string? ToothFdi,
    string? Surface,
    string? Phase,
    int Quantity,
    decimal UnitPriceSnapshot,
    decimal TotalAmount,
    string? Notes);

public sealed record TreatmentPlanDto(
    Guid Id,
    Guid ClinicId,
    Guid PatientId,
    Guid SourceEncounterId,
    TreatmentPlanStatus Status,
    int Version,
    DateTime? ApprovedAtUtc,
    decimal EstimateTotal,
    IReadOnlyList<TreatmentPlanItemDto> Items,
    DateTime CreatedAtUtc,
    DateTime? UpdatedAtUtc);
