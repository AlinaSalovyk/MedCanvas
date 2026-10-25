using MediatR;

namespace MedCanvas.Application.Features.Scheduling;

public sealed record CreateAppointmentCommand(
    Guid PatientId,
    Guid ClinicianUserId,
    Guid ChairId,
    DateTime StartAtUtc,
    DateTime EndAtUtc,
    string ReasonForVisit,
    string? InternalNote = null) : IRequest<AppointmentDto>;
