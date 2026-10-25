using MedCanvas.Application.Common.Exceptions;
using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Domain.Entities;
using MedCanvas.Domain.Exceptions;
using MediatR;

namespace MedCanvas.Application.Features.Patients;

public sealed class CreatePatientCommandHandler : IRequestHandler<CreatePatientCommand, PatientDto>
{
    private readonly IPatientRepository _patientRepository;
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IMedCanvasDbContext _dbContext;
    private readonly IDateTimeProvider _dateTimeProvider;

    public CreatePatientCommandHandler(
        IPatientRepository patientRepository,
        ICurrentUserContext currentUserContext,
        IMedCanvasDbContext dbContext,
        IDateTimeProvider dateTimeProvider)
    {
        _patientRepository = patientRepository;
        _currentUserContext = currentUserContext;
        _dbContext = dbContext;
        _dateTimeProvider = dateTimeProvider;
    }

    public async Task<PatientDto> Handle(CreatePatientCommand request, CancellationToken cancellationToken)
    {
        if (!_currentUserContext.IsAuthenticated || _currentUserContext.ClinicId == null)
        {
            throw new UnauthorizedAccessException("Authenticated clinic context is required to register a patient.");
        }

        var clinicId = _currentUserContext.ClinicId.Value;

        if (!string.IsNullOrWhiteSpace(request.ExternalMedicalRecordNumber))
        {
            var exists = await _patientRepository.ExistsByMrnAsync(
                request.ExternalMedicalRecordNumber,
                clinicId,
                null,
                cancellationToken);

            if (exists)
            {
                throw new DuplicateMedicalRecordNumberException();
            }
        }

        var now = _dateTimeProvider.UtcNow;
        var patient = Patient.Create(
            clinicId,
            request.FirstName,
            request.LastName,
            request.DateOfBirth,
            request.Gender,
            request.Phone,
            request.Email,
            request.ExternalMedicalRecordNumber,
            request.MedicalAlerts,
            now);

        _patientRepository.Add(patient);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new PatientDto(
            patient.Id,
            patient.ClinicId,
            patient.FirstName,
            patient.LastName,
            patient.FullName,
            patient.DateOfBirth,
            patient.Gender,
            patient.Phone,
            patient.Email,
            patient.ExternalMedicalRecordNumber,
            patient.MedicalAlerts,
            patient.IsActive,
            patient.ConcurrencyVersion,
            patient.CreatedAtUtc,
            patient.UpdatedAtUtc);
    }
}
