using MedCanvas.Application.Common.Exceptions;
using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Domain.Entities;
using MediatR;

namespace MedCanvas.Application.Features.Encounters;

public sealed class GetPatientEncountersQueryHandler : IRequestHandler<GetPatientEncountersQuery, IReadOnlyList<EncounterDto>>
{
    private readonly IEncounterRepository _encounterRepository;
    private readonly IPatientRepository _patientRepository;
    private readonly ICurrentUserContext _currentUserContext;

    public GetPatientEncountersQueryHandler(
        IEncounterRepository encounterRepository,
        IPatientRepository patientRepository,
        ICurrentUserContext currentUserContext)
    {
        _encounterRepository = encounterRepository;
        _patientRepository = patientRepository;
        _currentUserContext = currentUserContext;
    }

    public async Task<IReadOnlyList<EncounterDto>> Handle(GetPatientEncountersQuery request, CancellationToken cancellationToken)
    {
        if (!_currentUserContext.IsAuthenticated || _currentUserContext.ClinicId == null)
        {
            throw new UnauthorizedAccessException("Authenticated clinic context is required to query patient encounters.");
        }

        var clinicId = _currentUserContext.ClinicId.Value;

        var patient = await _patientRepository.GetByIdAsync(request.PatientId, clinicId, cancellationToken);
        if (patient == null)
        {
            throw new NotFoundException(nameof(Patient), request.PatientId);
        }

        var encounters = await _encounterRepository.GetByPatientIdAsync(patient.Id, clinicId, cancellationToken);

        return encounters
            .OrderByDescending(e => e.EncounterDateUtc)
            .Select(e => new EncounterDto(
                e.Id,
                e.ClinicId,
                e.PatientId,
                e.AttendingUserId,
                e.EncounterDateUtc,
                e.ChiefComplaint,
                e.ClinicalNotes,
                e.Status.ToString(),
                e.AppointmentId,
                e.CreatedAtUtc,
                e.UpdatedAtUtc))
            .ToList();
    }
}
