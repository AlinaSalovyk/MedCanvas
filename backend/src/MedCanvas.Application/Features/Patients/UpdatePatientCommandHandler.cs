using MedCanvas.Application.Common.Exceptions;
using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Domain.Entities;
using MedCanvas.Domain.Exceptions;
using MediatR;

namespace MedCanvas.Application.Features.Patients;

public sealed class UpdatePatientCommandHandler : IRequestHandler<UpdatePatientCommand, PatientDto>
{
    private readonly IPatientRepository _patientRepository;
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IMedCanvasDbContext _dbContext;
    private readonly IDateTimeProvider _dateTimeProvider;

    public UpdatePatientCommandHandler(
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

    public async Task<PatientDto> Handle(UpdatePatientCommand request, CancellationToken cancellationToken)
    {
        if (!_currentUserContext.IsAuthenticated || _currentUserContext.ClinicId == null)
        {
            throw new UnauthorizedAccessException("Authenticated clinic context is required to update patient demographics.");
        }

        var clinicId = _currentUserContext.ClinicId.Value;

        var patient = await _patientRepository.GetByIdAsync(request.Id, clinicId, cancellationToken);
        if (patient == null)
        {
            throw new NotFoundException(nameof(Patient), request.Id);
        }

        if (!string.IsNullOrWhiteSpace(request.ExternalMedicalRecordNumber))
        {
            var exists = await _patientRepository.ExistsByMrnAsync(
                request.ExternalMedicalRecordNumber,
                clinicId,
                patient.Id,
                cancellationToken);

            if (exists)
            {
                throw new DuplicateMedicalRecordNumberException();
            }
        }

        if (!request.ExpectedVersion.HasValue)
        {
            throw new PreconditionRequiredException("Updating an existing patient requires an If-Match concurrency precondition.");
        }

        var now = _dateTimeProvider.UtcNow;
        patient.UpdateDemographics(
            request.FirstName,
            request.LastName,
            request.DateOfBirth,
            request.Gender,
            request.Phone,
            request.Email,
            request.ExternalMedicalRecordNumber,
            request.ExpectedVersion.Value,
            now);

        if (request.MedicalAlerts != patient.MedicalAlerts)
        {
            patient.UpdateMedicalAlerts(request.MedicalAlerts, now);
        }

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
