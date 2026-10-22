using MedCanvas.Application.Common.Exceptions;
using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Domain.Entities;
using MediatR;

namespace MedCanvas.Application.Features.Odontograms;

public sealed class GetOdontogramRevisionsQueryHandler : IRequestHandler<GetOdontogramRevisionsQuery, IReadOnlyList<OdontogramRevisionDto>>
{
    private readonly IOdontogramRepository _odontogramRepository;
    private readonly ICurrentUserContext _currentUserContext;

    public GetOdontogramRevisionsQueryHandler(
        IOdontogramRepository odontogramRepository,
        ICurrentUserContext currentUserContext)
    {
        _odontogramRepository = odontogramRepository;
        _currentUserContext = currentUserContext;
    }

    public async Task<IReadOnlyList<OdontogramRevisionDto>> Handle(GetOdontogramRevisionsQuery request, CancellationToken cancellationToken)
    {
        if (!_currentUserContext.IsAuthenticated || _currentUserContext.ClinicId == null)
        {
            throw new UnauthorizedAccessException("Authenticated clinic context is required to query odontogram revisions.");
        }

        var clinicId = _currentUserContext.ClinicId.Value;

        var record = await _odontogramRepository.GetByEncounterIdAsync(request.EncounterId, clinicId, cancellationToken);
        if (record == null)
        {
            throw new NotFoundException(nameof(OdontogramRecord), request.EncounterId);
        }

        var revisions = await _odontogramRepository.GetRevisionsAsync(record.Id, clinicId, cancellationToken);

        return revisions
            .OrderByDescending(r => r.RevisionNumber)
            .Select(r => new OdontogramRevisionDto(
                r.Id,
                r.OdontogramRecordId,
                r.RevisionNumber,
                r.SnapshotJson,
                r.CreatedByUserId,
                r.ChangeSummary,
                r.CreatedAtUtc))
            .ToList();
    }
}
