using System.Text.Json.Serialization;
using MedCanvas.Domain.Enums;

namespace MedCanvas.Application.Features.Billing;

public sealed record SimulatedPaymentDto(
    Guid Id,
    decimal Amount,
    string MethodLabel,
    [property: JsonConverter(typeof(JsonStringEnumConverter<SimulatedPaymentStatus>))] SimulatedPaymentStatus Status,
    string? VoidReason,
    string RecordedByFullName,
    DateTime RecordedAtUtc);

public sealed record InvoiceDto(
    Guid Id,
    Guid ClinicId,
    Guid PatientId,
    string PatientFullName,
    Guid EncounterId,
    string InvoiceNumber,
    decimal TotalAmount,
    string Currency,
    [property: JsonConverter(typeof(JsonStringEnumConverter<InvoiceStatus>))] InvoiceStatus Status,
    decimal SimulatedPaid,
    decimal RemainingBalance,
    bool IsDemo,
    IReadOnlyList<InvoiceLineDto> Lines,
    IReadOnlyList<SimulatedPaymentDto> Payments,
    DateTime CreatedAtUtc,
    DateTime? UpdatedAtUtc,
    bool HasLineSnapshot = false);

public sealed record InvoiceLineDto(
    Guid PerformedProcedureId,
    string CatalogItemName,
    string? ToothFdi,
    int Quantity,
    decimal UnitPriceSnapshot,
    decimal TotalAmount);
