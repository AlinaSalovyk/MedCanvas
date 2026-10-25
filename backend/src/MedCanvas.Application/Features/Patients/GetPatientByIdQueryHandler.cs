using MedCanvas.Application.Common.Exceptions;
using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Domain.Entities;
using MediatR;

namespace MedCanvas.Application.Features.Patients;

public sealed class GetPatientByIdQueryHandler : IRequestHandler<GetPatientByIdQuery, PatientDto>
{
    private readonly IPatientRepository _patientRepository;
    private readonly ICurrentUserContext _currentUserContext;

    public GetPatientByIdQueryHandler(
        IPatientRepository patientRepository,
        ICurrentUserContext currentUserContext)
    {
        _patientRepository = patientRepository;
        _currentUserContext = currentUserContext;
    }

    public async Task<PatientDto> Handle(GetPatientByIdQuery request, CancellationToken cancellationToken)
    {
        if (!_currentUserContext.IsAuthenticated || _currentUserContext.ClinicId == null)
        {
            throw new UnauthorizedAccessException("Authenticated clinic context is required to query patient records.");
        }

        var clinicId = _currentUserContext.ClinicId.Value;

        var patient = await _patientRepository.GetByIdAsync(request.Id, clinicId, cancellationToken);
        if (patient == null)
        {
            throw new NotFoundException(nameof(Patient), request.Id);
        }

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
