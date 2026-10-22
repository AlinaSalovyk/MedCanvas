using MedCanvas.Application.Common.Exceptions;
using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace MedCanvas.Application.Features.Fhir;

public sealed class GetEncounterFhirBundleQueryHandler : IRequestHandler<GetEncounterFhirBundleQuery, string>
{
    private readonly IOdontogramRepository _odontogramRepository;
    private readonly IEncounterRepository _encounterRepository;
    private readonly IPatientRepository _patientRepository;
    private readonly IMedCanvasDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;

    public GetEncounterFhirBundleQueryHandler(
        IOdontogramRepository odontogramRepository,
        IEncounterRepository encounterRepository,
        IPatientRepository patientRepository,
        IMedCanvasDbContext dbContext,
        ICurrentUserContext currentUserContext)
    {
        _odontogramRepository = odontogramRepository;
        _encounterRepository = encounterRepository;
        _patientRepository = patientRepository;
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
    }

    public async Task<string> Handle(GetEncounterFhirBundleQuery request, CancellationToken cancellationToken)
    {
        if (!_currentUserContext.IsAuthenticated || _currentUserContext.ClinicId == null)
        {
            throw new UnauthorizedAccessException("Authenticated clinic context is required to export FHIR bundles.");
        }

        var clinicId = _currentUserContext.ClinicId.Value;

        var encounter = await _encounterRepository.GetByIdAsync(request.EncounterId, clinicId, cancellationToken);
        if (encounter == null)
        {
            throw new NotFoundException(nameof(DentalEncounter), request.EncounterId);
        }

        var patient = await _patientRepository.GetByIdAsync(encounter.PatientId, clinicId, cancellationToken);
        if (patient == null)
        {
            throw new NotFoundException(nameof(Patient), encounter.PatientId);
        }

        var clinic = await _dbContext.Clinics
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == clinicId, cancellationToken);

        if (clinic == null)
        {
            throw new NotFoundException(nameof(Clinic), clinicId);
        }

        var record = await _odontogramRepository.GetByEncounterIdAsync(encounter.Id, clinicId, cancellationToken);
        if (record == null)
        {
            throw new NotFoundException(nameof(OdontogramRecord), encounter.Id);
        }

        return FhirBundleBuilder.BuildBundle(clinic, patient, encounter, record);
    }
}
