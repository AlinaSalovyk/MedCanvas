using MedCanvas.Application.Common.Exceptions;
using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Domain.Entities;
using MediatR;

namespace MedCanvas.Application.Features.Odontograms;

public sealed class GetOdontogramByEncounterQueryHandler : IRequestHandler<GetOdontogramByEncounterQuery, OdontogramResponseDto>
{
    private readonly IOdontogramRepository _odontogramRepository;
    private readonly ICurrentUserContext _currentUserContext;

    public GetOdontogramByEncounterQueryHandler(
        IOdontogramRepository odontogramRepository,
        ICurrentUserContext currentUserContext)
    {
        _odontogramRepository = odontogramRepository;
        _currentUserContext = currentUserContext;
    }

    public async Task<OdontogramResponseDto> Handle(GetOdontogramByEncounterQuery request, CancellationToken cancellationToken)
    {
        if (!_currentUserContext.IsAuthenticated || _currentUserContext.ClinicId == null)
        {
            throw new UnauthorizedAccessException("Authenticated clinic context is required to query an odontogram.");
        }

        var clinicId = _currentUserContext.ClinicId.Value;

        var record = await _odontogramRepository.GetByEncounterIdAsync(request.EncounterId, clinicId, cancellationToken);
        if (record == null)
        {
            throw new NotFoundException(nameof(OdontogramRecord), request.EncounterId);
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
