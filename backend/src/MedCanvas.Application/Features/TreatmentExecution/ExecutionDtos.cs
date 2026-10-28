using System.Text.Json.Serialization;
using MedCanvas.Domain.Enums;

namespace MedCanvas.Application.Features.TreatmentExecution;

public sealed record PerformedProcedureDto(
    Guid Id,
    Guid ClinicId,
    Guid PatientId,
    Guid EncounterId,
    Guid? TreatmentPlanItemId,
    Guid ProcedureCatalogItemId,
    string CatalogItemName,
    string? ToothFdi,
    int Quantity,
    decimal UnitPriceSnapshot,
    decimal TotalAmount,
    string? ClinicalNote,
    [property: JsonConverter(typeof(JsonStringEnumConverter<PerformedProcedureStatus>))] PerformedProcedureStatus Status,
    string? VoidReason,
    Guid PerformedByUserId,
    string PerformedByFullName,
    DateTime PerformedAtUtc);
