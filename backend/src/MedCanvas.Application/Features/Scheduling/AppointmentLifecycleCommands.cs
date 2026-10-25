using MediatR;

namespace MedCanvas.Application.Features.Scheduling;

public sealed record ConfirmAppointmentCommand(Guid AppointmentId) : IRequest<AppointmentDto>;
public sealed record MarkAppointmentArrivedCommand(Guid AppointmentId) : IRequest<AppointmentDto>;
public sealed record CompleteAppointmentCommand(Guid AppointmentId) : IRequest<AppointmentDto>;
public sealed record MarkAppointmentNoShowCommand(Guid AppointmentId) : IRequest<AppointmentDto>;
public sealed record CancelAppointmentCommand(Guid AppointmentId, string Reason) : IRequest<AppointmentDto>;
public sealed record RescheduleAppointmentCommand(
    Guid AppointmentId,
    DateTime NewStartAtUtc,
    DateTime NewEndAtUtc,
    Guid? NewChairId = null,
    int? ExpectedVersion = null) : IRequest<AppointmentDto>;
