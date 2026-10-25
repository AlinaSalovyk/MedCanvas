using MedCanvas.Application.Common.Exceptions;
using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Domain.Entities;
using MedCanvas.Domain.Exceptions;
using MediatR;

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

        var encounter = DentalEncounter.Start(
            clinicId,
            patient.Id,
            userId,
            encounterDate,
            request.ChiefComplaint,
            now);

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
            encounter.CreatedAtUtc,
            encounter.UpdatedAtUtc);
    }
}
