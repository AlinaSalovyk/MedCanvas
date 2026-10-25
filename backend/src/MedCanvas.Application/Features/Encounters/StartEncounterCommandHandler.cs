using MedCanvas.Application.Common.Exceptions;
using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Domain.Entities;
using MedCanvas.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace MedCanvas.Application.Features.Encounters;

public sealed class StartEncounterCommandHandler : IRequestHandler<StartEncounterCommand, EncounterDto>
{
    private readonly IEncounterRepository _encounterRepository;
    private readonly IPatientRepository _patientRepository;
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IMedCanvasDbContext _dbContext;
    private readonly IDateTimeProvider _dateTimeProvider;

    public StartEncounterCommandHandler(
        IEncounterRepository encounterRepository,
        IPatientRepository patientRepository,
        ICurrentUserContext currentUserContext,
        IMedCanvasDbContext dbContext,
        IDateTimeProvider dateTimeProvider)
    {
        _encounterRepository = encounterRepository;
        _patientRepository = patientRepository;
        _currentUserContext = currentUserContext;
        _dbContext = dbContext;
        _dateTimeProvider = dateTimeProvider;
    }

    public async Task<EncounterDto> Handle(StartEncounterCommand request, CancellationToken cancellationToken)
    {
        if (!_currentUserContext.IsAuthenticated || _currentUserContext.ClinicId == null || _currentUserContext.UserId == null)
        {
            throw new UnauthorizedAccessException("Authenticated clinician context is required to start a dental encounter.");
        }

        var clinicId = _currentUserContext.ClinicId.Value;
        var userId = _currentUserContext.UserId.Value;

        var patient = await _patientRepository.GetByIdAsync(request.PatientId, clinicId, cancellationToken);
        if (patient == null)
        {
            throw new NotFoundException(nameof(Patient), request.PatientId);
        }

        if (!patient.IsActive)
        {
            // Archived patients keep their history readable but cannot start new care episodes.
            throw new DomainException("Patient is archived and cannot start a new encounter. Restore the patient first.");
        }

        var now = _dateTimeProvider.UtcNow;
        var encounterDate = request.EncounterDateUtc ?? now;

        // FR-301: an encounter may be anchored to a calendar appointment, but the link is
        // validated — the appointment must belong to this clinic, this patient, and be in
        // an active pre-encounter state. Cross-patient appointment links are rejected.
        if (request.AppointmentId.HasValue)
        {
            var appointment = await _dbContext.Appointments
                .AsNoTracking()
                .FirstOrDefaultAsync(a => a.Id == request.AppointmentId.Value && a.ClinicId == clinicId, cancellationToken);

            if (appointment == null)
            {
                throw new NotFoundException(nameof(Appointment), request.AppointmentId.Value);
            }

            if (appointment.PatientId != patient.Id)
            {
                throw new DomainException("The referenced appointment belongs to a different patient.");
            }

            if (appointment.Status is not (Domain.Enums.AppointmentStatus.Scheduled or Domain.Enums.AppointmentStatus.Confirmed or Domain.Enums.AppointmentStatus.Arrived))
            {
                throw new DomainException($"Appointment in status '{appointment.Status}' cannot be started as an encounter.");
            }
        }

        var encounter = DentalEncounter.Start(
            clinicId,
            patient.Id,
            userId,
            encounterDate,
            request.ChiefComplaint,
            now,
            request.AppointmentId);

        _encounterRepository.Add(encounter);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new EncounterDto(
            encounter.Id,
            encounter.ClinicId,
            encounter.PatientId,
            encounter.AttendingUserId,
            encounter.EncounterDateUtc,
            encounter.ChiefComplaint,
            encounter.ClinicalNotes,
            encounter.Status.ToString(),
            encounter.AppointmentId,
            encounter.CreatedAtUtc,
            encounter.UpdatedAtUtc);
    }
}
