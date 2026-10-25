using System.Text.Json;
using MedCanvas.Application.Common.Exceptions;
using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Domain.Entities;
using MediatR;

namespace MedCanvas.Application.Features.Odontograms;

public sealed class SaveOdontogramCommandHandler : IRequestHandler<SaveOdontogramCommand, OdontogramResponseDto>
{
    private readonly IOdontogramRepository _odontogramRepository;
    private readonly IEncounterRepository _encounterRepository;
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IMedCanvasDbContext _dbContext;
    private readonly IDateTimeProvider _dateTimeProvider;

    public SaveOdontogramCommandHandler(
        IOdontogramRepository odontogramRepository,
        IEncounterRepository encounterRepository,
        ICurrentUserContext currentUserContext,
        IMedCanvasDbContext dbContext,
        IDateTimeProvider dateTimeProvider)
    {
        _odontogramRepository = odontogramRepository;
        _encounterRepository = encounterRepository;
        _currentUserContext = currentUserContext;
        _dbContext = dbContext;
        _dateTimeProvider = dateTimeProvider;
    }

    public async Task<OdontogramResponseDto> Handle(SaveOdontogramCommand request, CancellationToken cancellationToken)
    {
        if (!_currentUserContext.IsAuthenticated || _currentUserContext.ClinicId == null || _currentUserContext.UserId == null)
        {
            throw new UnauthorizedAccessException("Authenticated clinician context is required to modify odontogram records.");
        }

        var clinicId = _currentUserContext.ClinicId.Value;
        var userId = _currentUserContext.UserId.Value;

        var encounter = await _encounterRepository.GetByIdAsync(request.EncounterId, clinicId, cancellationToken);
        if (encounter == null)
        {
            throw new NotFoundException(nameof(DentalEncounter), request.EncounterId);
        }

        // FR-306: a finished (completed/cancelled) encounter's clinical record is sealed —
        // no silent back-dated edits. Corrections go through an explicitly defined process.
        if (encounter.Status != Domain.Enums.EncounterStatus.InProgress)
        {
            throw new Domain.Exceptions.DomainException(
                $"Encounter is '{encounter.Status}'; its odontogram can no longer be modified. Start a new encounter for corrections.");
        }

        string payloadVersion = "2.22";
        try
        {
            using var doc = JsonDocument.Parse(request.SnapshotJson);
            if (doc.RootElement.TryGetProperty("version", out var vProp) && vProp.GetString() is { } vStr)
            {
                payloadVersion = vStr;
            }
        }
        catch
        {
            // fallback to default
        }

        var now = _dateTimeProvider.UtcNow;
        var existingRecord = await _odontogramRepository.GetByEncounterIdAsync(encounter.Id, clinicId, cancellationToken);

        OdontogramRecord record;
        if (existingRecord == null)
        {
            record = OdontogramRecord.Create(
                clinicId,
                encounter.PatientId,
                encounter.Id,
                payloadVersion,
                request.SnapshotJson,
                now);

            _odontogramRepository.Add(record);
        }
        else
        {
            if (!request.ExpectedVersion.HasValue)
            {
                throw new PreconditionRequiredException(
                    "An If-Match header or expectedVersion property is required to update an existing clinical odontogram record.");
            }

            record = existingRecord;
            record.UpdatePayload(request.SnapshotJson, request.ExpectedVersion.Value, now);
        }

        var revision = OdontogramRevision.Create(
            record,
            record.ConcurrencyVersion,
            userId,
            request.ChangeSummary,
            now);

        _odontogramRepository.AddRevision(revision);

        var auditEvent = ClinicalAuditEvent.Create(
            clinicId,
            encounter.PatientId,
            encounter.Id,
            userId,
            existingRecord == null ? "ODONTOGRAM_CREATED" : "ODONTOGRAM_UPDATED",
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
