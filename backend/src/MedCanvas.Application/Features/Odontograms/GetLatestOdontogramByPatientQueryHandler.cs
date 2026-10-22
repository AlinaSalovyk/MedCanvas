using MedCanvas.Application.Common.Exceptions;
using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Domain.Entities;
using MediatR;

namespace MedCanvas.Application.Features.Odontograms;

public sealed class GetLatestOdontogramByPatientQueryHandler : IRequestHandler<GetLatestOdontogramByPatientQuery, OdontogramResponseDto>
{
    private readonly IOdontogramRepository _odontogramRepository;
    private readonly IPatientRepository _patientRepository;
    private readonly ICurrentUserContext _currentUserContext;

    public GetLatestOdontogramByPatientQueryHandler(
        IOdontogramRepository odontogramRepository,
        IPatientRepository patientRepository,
        ICurrentUserContext currentUserContext)
    {
        _odontogramRepository = odontogramRepository;
        _patientRepository = patientRepository;
        _currentUserContext = currentUserContext;
    }

    public async Task<OdontogramResponseDto> Handle(GetLatestOdontogramByPatientQuery request, CancellationToken cancellationToken)
    {
        if (!_currentUserContext.IsAuthenticated || _currentUserContext.ClinicId == null)
        {
            throw new UnauthorizedAccessException("Authenticated clinic context is required to query patient odontogram.");
        }

        var clinicId = _currentUserContext.ClinicId.Value;

        var patient = await _patientRepository.GetByIdAsync(request.PatientId, clinicId, cancellationToken);
        if (patient == null)
        {
            throw new NotFoundException(nameof(Patient), request.PatientId);
        }

        var record = await _odontogramRepository.GetLatestByPatientIdAsync(patient.Id, clinicId, cancellationToken);
        if (record == null)
        {
            throw new NotFoundException(nameof(OdontogramRecord), $"PatientId:{patient.Id}");
        }

        return new OdontogramResponseDto(
            record.Id,
            record.ClinicId,
            record.PatientId,
            record.EncounterId,
            record.PayloadVersion,
            record.SnapshotJson,
            record.ConcurrencyVersion,
            $"\"{record.ConcurrencyVersion}\"",
            record.IsFinalized,
            record.FinalizedAtUtc,
            record.FinalizedByUserId,
            record.CreatedAtUtc,
            record.UpdatedAtUtc);
    }
}
