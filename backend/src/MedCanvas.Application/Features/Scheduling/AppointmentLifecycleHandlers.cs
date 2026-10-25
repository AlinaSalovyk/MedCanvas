using FluentValidation;
using MedCanvas.Application.Common.Exceptions;
using MedCanvas.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace MedCanvas.Application.Features.Scheduling;

public sealed class ConfirmAppointmentCommandHandler : IRequestHandler<ConfirmAppointmentCommand, AppointmentDto>
{
    private readonly IMedCanvasDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IDateTimeProvider _dateTimeProvider;
    private readonly IDbConstraintViolations _dbConstraintViolations;

    public ConfirmAppointmentCommandHandler(IMedCanvasDbContext dbContext, ICurrentUserContext currentUserContext, IDateTimeProvider dateTimeProvider, IDbConstraintViolations dbConstraintViolations)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
        _dateTimeProvider = dateTimeProvider;
        _dbConstraintViolations = dbConstraintViolations;
    }

    public Task<AppointmentDto> Handle(ConfirmAppointmentCommand request, CancellationToken cancellationToken)
    {
        return Transition(_dbContext, _currentUserContext, _dateTimeProvider, _dbConstraintViolations, request.AppointmentId,
            (a, now) => a.Confirm(now), "APPOINTMENT_CONFIRMED", cancellationToken);
    }

    internal static async Task<AppointmentDto> Transition(
        IMedCanvasDbContext dbContext,
        ICurrentUserContext currentUserContext,
        IDateTimeProvider dateTimeProvider,
        IDbConstraintViolations dbConstraintViolations,
        Guid appointmentId,
        Action<Domain.Entities.Appointment, DateTime> mutate,
        string auditAction,
        CancellationToken cancellationToken)
    {
        var appointment = await AppointmentTransitions.LoadAsync(dbContext, currentUserContext, appointmentId, cancellationToken);
        var now = dateTimeProvider.UtcNow;
        mutate(appointment, now);
        return await AppointmentTransitions.SaveAndProjectAsync(
            dbContext, currentUserContext, dbConstraintViolations, appointment, auditAction, $"appointment:{appointmentId}", now,
            () => Task.CompletedTask, cancellationToken);
    }
}

public sealed class MarkAppointmentArrivedCommandHandler : IRequestHandler<MarkAppointmentArrivedCommand, AppointmentDto>
{
    private readonly IMedCanvasDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IDateTimeProvider _dateTimeProvider;
    private readonly IDbConstraintViolations _dbConstraintViolations;

    public MarkAppointmentArrivedCommandHandler(IMedCanvasDbContext dbContext, ICurrentUserContext currentUserContext, IDateTimeProvider dateTimeProvider, IDbConstraintViolations dbConstraintViolations)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
        _dateTimeProvider = dateTimeProvider;
        _dbConstraintViolations = dbConstraintViolations;
    }

    public Task<AppointmentDto> Handle(MarkAppointmentArrivedCommand request, CancellationToken cancellationToken) =>
        ConfirmAppointmentCommandHandler.Transition(_dbContext, _currentUserContext, _dateTimeProvider, _dbConstraintViolations, request.AppointmentId,
            (a, now) => a.MarkArrived(now), "APPOINTMENT_ARRIVED", cancellationToken);
}

public sealed class CompleteAppointmentCommandHandler : IRequestHandler<CompleteAppointmentCommand, AppointmentDto>
{
    private readonly IMedCanvasDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IDateTimeProvider _dateTimeProvider;
    private readonly IDbConstraintViolations _dbConstraintViolations;

    public CompleteAppointmentCommandHandler(IMedCanvasDbContext dbContext, ICurrentUserContext currentUserContext, IDateTimeProvider dateTimeProvider, IDbConstraintViolations dbConstraintViolations)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
        _dateTimeProvider = dateTimeProvider;
        _dbConstraintViolations = dbConstraintViolations;
    }

    public Task<AppointmentDto> Handle(CompleteAppointmentCommand request, CancellationToken cancellationToken) =>
        ConfirmAppointmentCommandHandler.Transition(_dbContext, _currentUserContext, _dateTimeProvider, _dbConstraintViolations, request.AppointmentId,
            (a, now) => a.Complete(now), "APPOINTMENT_COMPLETED", cancellationToken);
}

public sealed class MarkAppointmentNoShowCommandHandler : IRequestHandler<MarkAppointmentNoShowCommand, AppointmentDto>
{
    private readonly IMedCanvasDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IDateTimeProvider _dateTimeProvider;
    private readonly IDbConstraintViolations _dbConstraintViolations;

    public MarkAppointmentNoShowCommandHandler(IMedCanvasDbContext dbContext, ICurrentUserContext currentUserContext, IDateTimeProvider dateTimeProvider, IDbConstraintViolations dbConstraintViolations)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
        _dateTimeProvider = dateTimeProvider;
        _dbConstraintViolations = dbConstraintViolations;
    }

    public Task<AppointmentDto> Handle(MarkAppointmentNoShowCommand request, CancellationToken cancellationToken) =>
        ConfirmAppointmentCommandHandler.Transition(_dbContext, _currentUserContext, _dateTimeProvider, _dbConstraintViolations, request.AppointmentId,
            (a, now) => a.MarkNoShow(now), "APPOINTMENT_NO_SHOW", cancellationToken);
}

public sealed class CancelAppointmentCommandHandler : IRequestHandler<CancelAppointmentCommand, AppointmentDto>
{
    private readonly IMedCanvasDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IDateTimeProvider _dateTimeProvider;
    private readonly IDbConstraintViolations _dbConstraintViolations;

    public CancelAppointmentCommandHandler(IMedCanvasDbContext dbContext, ICurrentUserContext currentUserContext, IDateTimeProvider dateTimeProvider, IDbConstraintViolations dbConstraintViolations)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
        _dateTimeProvider = dateTimeProvider;
        _dbConstraintViolations = dbConstraintViolations;
    }

    public Task<AppointmentDto> Handle(CancelAppointmentCommand request, CancellationToken cancellationToken) =>
        ConfirmAppointmentCommandHandler.Transition(_dbContext, _currentUserContext, _dateTimeProvider, _dbConstraintViolations, request.AppointmentId,
            (a, now) => a.Cancel(request.Reason, now), "APPOINTMENT_CANCELLED", cancellationToken);
}

public sealed class CancelAppointmentCommandValidator : AbstractValidator<CancelAppointmentCommand>
{
    public CancelAppointmentCommandValidator()
    {
        RuleFor(x => x.AppointmentId).NotEmpty().WithMessage("Appointment identifier is required.");
        RuleFor(x => x.Reason)
            .NotEmpty().WithMessage("Cancellation reason is required.")
            .MaximumLength(500).WithMessage("Cancellation reason cannot exceed 500 characters.");
    }
}

public sealed class RescheduleAppointmentCommandHandler : IRequestHandler<RescheduleAppointmentCommand, AppointmentDto>
{
    private readonly IMedCanvasDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IDateTimeProvider _dateTimeProvider;
    private readonly IDbConstraintViolations _dbConstraintViolations;

    public RescheduleAppointmentCommandHandler(IMedCanvasDbContext dbContext, ICurrentUserContext currentUserContext, IDateTimeProvider dateTimeProvider, IDbConstraintViolations dbConstraintViolations)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
        _dateTimeProvider = dateTimeProvider;
        _dbConstraintViolations = dbConstraintViolations;
    }

    public async Task<AppointmentDto> Handle(RescheduleAppointmentCommand request, CancellationToken cancellationToken)
    {
        var appointment = await AppointmentTransitions.LoadAsync(_dbContext, _currentUserContext, request.AppointmentId, cancellationToken);

        if (!request.ExpectedVersion.HasValue)
        {
            throw new PreconditionRequiredException("Rescheduling an appointment requires an If-Match concurrency precondition.");
        }

        if (request.NewStartAtUtc.Kind != DateTimeKind.Utc || request.NewEndAtUtc.Kind != DateTimeKind.Utc)
        {
            throw new Domain.Exceptions.DomainException("Reschedule times must be specified in UTC.");
        }

        var now = _dateTimeProvider.UtcNow;
        appointment.Reschedule(request.NewStartAtUtc, request.NewEndAtUtc, request.NewChairId, request.ExpectedVersion.Value, now);

        var clinicId = appointment.ClinicId;
        var clinicTimeZone = await _dbContext.Clinics
            .AsNoTracking()
            .Where(c => c.Id == clinicId)
            .Select(c => c.TimeZoneId)
            .FirstAsync(cancellationToken);

        return await AppointmentTransitions.SaveAndProjectAsync(
            _dbContext, _currentUserContext, _dbConstraintViolations, appointment, "APPOINTMENT_RESCHEDULED",
            $"appointment:{appointment.Id}", now,
            async () =>
            {
                await SchedulingGuards.EnsureWithinAvailabilityAsync(
                    _dbContext, clinicId, appointment.ClinicianUserId, clinicTimeZone,
                    appointment.StartAtUtc, appointment.EndAtUtc, cancellationToken);
                await SchedulingGuards.EnsureNoOverlapAsync(
                    _dbContext, clinicId, appointment.ClinicianUserId, appointment.ChairId,
                    appointment.StartAtUtc, appointment.EndAtUtc, appointment.Id, cancellationToken);
            },
            cancellationToken);
    }
}

public sealed class RescheduleAppointmentCommandValidator : AbstractValidator<RescheduleAppointmentCommand>
{
    public RescheduleAppointmentCommandValidator()
    {
        RuleFor(x => x.AppointmentId).NotEmpty().WithMessage("Appointment identifier is required.");
        RuleFor(x => x.NewStartAtUtc).NotEmpty().WithMessage("New start time is required.");
        RuleFor(x => x.NewEndAtUtc)
            .NotEmpty().WithMessage("New end time is required.")
            .GreaterThan(x => x.NewStartAtUtc).WithMessage("New end time must be after new start time.");
    }
}
