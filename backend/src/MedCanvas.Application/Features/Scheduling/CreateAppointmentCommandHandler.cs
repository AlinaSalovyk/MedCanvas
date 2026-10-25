using MedCanvas.Application.Common.Exceptions;
using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Domain.Entities;
using MedCanvas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace MedCanvas.Application.Features.Scheduling;

public sealed class CreateAppointmentCommandHandler : IRequestHandler<CreateAppointmentCommand, AppointmentDto>
{
    private readonly IMedCanvasDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IDateTimeProvider _dateTimeProvider;
    private readonly IDbConstraintViolations _dbConstraintViolations;

    public CreateAppointmentCommandHandler(
        IMedCanvasDbContext dbContext,
        ICurrentUserContext currentUserContext,
        IDateTimeProvider dateTimeProvider,
        IDbConstraintViolations dbConstraintViolations)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
        _dateTimeProvider = dateTimeProvider;
        _dbConstraintViolations = dbConstraintViolations;
    }

    public async Task<AppointmentDto> Handle(CreateAppointmentCommand request, CancellationToken cancellationToken)
    {
        if (!_currentUserContext.IsAuthenticated || _currentUserContext.ClinicId == null || _currentUserContext.UserId == null)
        {
            throw new UnauthorizedAccessException("Authenticated clinic context is required to book appointments.");
        }

        var clinicId = _currentUserContext.ClinicId.Value;
        var now = _dateTimeProvider.UtcNow;

        var patient = await _dbContext.Patients
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == request.PatientId && p.ClinicId == clinicId, cancellationToken);
        if (patient == null || !patient.IsActive)
        {
            throw new NotFoundException(nameof(Patient), request.PatientId);
        }

        var clinicianMembership = await _dbContext.ClinicMemberships
            .AsNoTracking()
            .FirstOrDefaultAsync(m =>
                m.ClinicId == clinicId &&
                m.UserId == request.ClinicianUserId &&
                m.IsActive &&
                (m.Role == MembershipRole.Clinician || m.Role == MembershipRole.ClinicAdmin), cancellationToken);
        if (clinicianMembership == null)
        {
            throw new NotFoundException(nameof(ClinicMembership), request.ClinicianUserId);
        }

        var clinician = await _dbContext.Users
            .AsNoTracking()
            .FirstAsync(u => u.Id == request.ClinicianUserId && u.IsActive, cancellationToken);

        var chair = await _dbContext.ClinicChairs
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == request.ChairId && c.ClinicId == clinicId && c.IsActive, cancellationToken);
        if (chair == null)
        {
            throw new NotFoundException(nameof(ClinicChair), request.ChairId);
        }

        var clinic = await _dbContext.Clinics
            .AsNoTracking()
            .FirstAsync(c => c.Id == clinicId, cancellationToken);

        await SchedulingGuards.EnsureWithinAvailabilityAsync(
            _dbContext, clinicId, request.ClinicianUserId, clinic.TimeZoneId, request.StartAtUtc, request.EndAtUtc, cancellationToken);

        await SchedulingGuards.EnsureNoOverlapAsync(
            _dbContext, clinicId, request.ClinicianUserId, request.ChairId, request.StartAtUtc, request.EndAtUtc, ignoreAppointmentId: null, cancellationToken);

        var appointment = Appointment.Create(
            clinicId,
            request.PatientId,
            request.ClinicianUserId,
            request.ChairId,
            request.StartAtUtc,
            request.EndAtUtc,
            request.ReasonForVisit,
            request.InternalNote,
            now);

        _dbContext.Appointments.Add(appointment);

        _dbContext.ClinicalAuditEvents.Add(ClinicalAuditEvent.Create(
            clinicId,
            patient.Id,
            null,
            _currentUserContext.UserId.Value,
            "APPOINTMENT_CREATED",
            null,
            $"appointment:{appointment.Id}",
            now));

        try
        {
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex) when (_dbConstraintViolations.IsExclusionViolation(ex))
        {
            throw new ConflictException("The selected time slot was just taken by another appointment. Refresh the calendar and try again.");
        }

        return new AppointmentDto(
            appointment.Id,
            appointment.ClinicId,
            appointment.PatientId,
            patient.FullName,
            appointment.ClinicianUserId,
            clinician.FullName,
            appointment.ChairId,
            chair.Name,
            appointment.StartAtUtc,
            appointment.EndAtUtc,
            appointment.Status,
            appointment.ReasonForVisit,
            appointment.InternalNote,
            appointment.CancellationReason,
            appointment.ConcurrencyVersion,
            appointment.CreatedAtUtc,
            appointment.UpdatedAtUtc);
    }
}
