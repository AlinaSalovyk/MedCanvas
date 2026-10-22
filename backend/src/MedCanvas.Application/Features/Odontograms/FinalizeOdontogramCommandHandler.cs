using MedCanvas.Application.Common.Exceptions;
using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Domain.Entities;
using MediatR;

namespace MedCanvas.Application.Features.Odontograms;

public sealed class FinalizeOdontogramCommandHandler : IRequestHandler<FinalizeOdontogramCommand, OdontogramResponseDto>
{
    private readonly IOdontogramRepository _odontogramRepository;
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IMedCanvasDbContext _dbContext;
    private readonly IDateTimeProvider _dateTimeProvider;

    public FinalizeOdontogramCommandHandler(
        IOdontogramRepository odontogramRepository,
        ICurrentUserContext currentUserContext,
        IMedCanvasDbContext dbContext,
        IDateTimeProvider dateTimeProvider)
    {
        _odontogramRepository = odontogramRepository;
        _currentUserContext = currentUserContext;
        _dbContext = dbContext;
        _dateTimeProvider = dateTimeProvider;
    }

    public async Task<OdontogramResponseDto> Handle(FinalizeOdontogramCommand request, CancellationToken cancellationToken)
    {
        if (!_currentUserContext.IsAuthenticated || _currentUserContext.ClinicId == null || _currentUserContext.UserId == null)
        {
            throw new UnauthorizedAccessException("Authenticated clinician context is required to finalize an odontogram.");
        }

        var clinicId = _currentUserContext.ClinicId.Value;
        var userId = _currentUserContext.UserId.Value;

        var record = await _odontogramRepository.GetByEncounterIdAsync(request.EncounterId, clinicId, cancellationToken);
        if (record == null)
        {
            throw new NotFoundException(nameof(OdontogramRecord), request.EncounterId);
        }

        var now = _dateTimeProvider.UtcNow;
        record.Finalize(userId, request.ExpectedVersion, now);

        var revision = OdontogramRevision.Create(
            record,
            record.ConcurrencyVersion,
            userId,
            "Chart finalized and sealed.",
            now);

        _odontogramRepository.AddRevision(revision);

        var auditEvent = ClinicalAuditEvent.Create(
            clinicId,
            record.PatientId,
            record.EncounterId,
            userId,
            "ODONTOGRAM_FINALIZED",
            null,
            $"rev:{record.ConcurrencyVersion}",
            now);

        _dbContext.ClinicalAuditEvents.Add(auditEvent);

        await _dbContext.SaveChangesAsync(cancellationToken);

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
