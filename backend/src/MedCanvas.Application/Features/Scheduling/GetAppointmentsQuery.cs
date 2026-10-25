using MediatR;

namespace MedCanvas.Application.Features.Scheduling;

/// <summary>Calendar window query (max 62 days), ordered by start time.</summary>
public sealed record GetAppointmentsQuery(
    DateTime FromUtc,
    DateTime ToUtc,
    Guid? ClinicianUserId = null,
    Guid? ChairId = null,
    Domain.Enums.AppointmentStatus? Status = null) : IRequest<IReadOnlyList<AppointmentDto>>;
