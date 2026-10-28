using System.Text.Json.Serialization;
using MedCanvas.Domain.Enums;

namespace MedCanvas.Application.Features.Scheduling;

public sealed record AppointmentDto(
    Guid Id,
    Guid ClinicId,
    Guid PatientId,
    string PatientFullName,
    Guid ClinicianUserId,
    string ClinicianFullName,
    Guid ChairId,
    string ChairName,
    DateTime StartAtUtc,
    DateTime EndAtUtc,
    [property: JsonConverter(typeof(JsonStringEnumConverter<AppointmentStatus>))] AppointmentStatus Status,
    string ReasonForVisit,
    string? InternalNote,
    string? CancellationReason,
    int ConcurrencyVersion,
    DateTime CreatedAtUtc,
    DateTime? UpdatedAtUtc);

public sealed record ChairDto(
    Guid Id,
    Guid ClinicId,
    string Name,
    bool IsActive);

public sealed record AvailabilityWindowDto(
    int DayOfWeek,
    TimeOnly StartTime,
    TimeOnly EndTime,
    IReadOnlyList<AvailabilityBreakDto> Breaks);

public sealed record AvailabilityBreakDto(TimeOnly StartTime, TimeOnly EndTime);

public sealed record AvailabilityTemplateDto(
    Guid ClinicianUserId,
    string ClinicianFullName,
    IReadOnlyList<AvailabilityWindowDto> Windows,
    IReadOnlyList<AvailabilityExceptionDto> Exceptions);

public sealed record AvailabilityExceptionDto(
    Guid Id,
    DateOnly Date,
    bool IsWorkingDay);
