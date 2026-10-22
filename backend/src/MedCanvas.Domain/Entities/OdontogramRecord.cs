using MedCanvas.Domain.Common;
using MedCanvas.Domain.Exceptions;

namespace MedCanvas.Domain.Entities;

/// <summary>
/// Aggregate root managing the canonical odontogram snapshot, optimistic locking, and clinical finalization.
/// </summary>
public sealed class OdontogramRecord : BaseEntity, IAggregateRoot
{
    public Guid ClinicId { get; private set; }
    public Guid PatientId { get; private set; }
    public Guid EncounterId { get; private set; }
    public string PayloadVersion { get; private set; } = "2.22";
    public string SnapshotJson { get; private set; } = string.Empty;
    public int ConcurrencyVersion { get; private set; }
    public bool IsFinalized { get; private set; }
    public DateTime? FinalizedAtUtc { get; private set; }
    public Guid? FinalizedByUserId { get; private set; }

    private OdontogramRecord()
    {
    }

    private OdontogramRecord(
        Guid id,
        Guid clinicId,
        Guid patientId,
        Guid encounterId,
        string payloadVersion,
        string snapshotJson,
        DateTime createdAtUtc)
        : base(id, createdAtUtc)
    {
        if (clinicId == Guid.Empty)
        {
            throw new ArgumentException("Clinic ID cannot be empty GUID.", nameof(clinicId));
        }

        if (patientId == Guid.Empty)
        {
            throw new ArgumentException("Patient ID cannot be empty GUID.", nameof(patientId));
        }

        if (encounterId == Guid.Empty)
        {
            throw new ArgumentException("Encounter ID cannot be empty GUID.", nameof(encounterId));
        }

        ClinicId = clinicId;
        PatientId = patientId;
        EncounterId = encounterId;
        SetPayloadVersion(payloadVersion);
        SetSnapshotJson(snapshotJson);

        ConcurrencyVersion = 1;
        IsFinalized = false;
    }

    public static OdontogramRecord Create(
        Guid clinicId,
        Guid patientId,
        Guid encounterId,
        string payloadVersion,
        string snapshotJson,
        DateTime utcNow)
    {
        return new OdontogramRecord(
            Guid.NewGuid(),
            clinicId,
            patientId,
            encounterId,
            payloadVersion,
            snapshotJson,
            utcNow);
    }

    public static OdontogramRecord CreateWithId(
        Guid id,
        Guid clinicId,
        Guid patientId,
        Guid encounterId,
        string payloadVersion,
        string snapshotJson,
        int concurrencyVersion,
        bool isFinalized,
        DateTime? finalizedAtUtc,
        Guid? finalizedByUserId,
        DateTime createdAtUtc,
        DateTime updatedAtUtc)
    {
        var record = new OdontogramRecord(
            id,
            clinicId,
            patientId,
            encounterId,
            payloadVersion,
            snapshotJson,
            createdAtUtc)
        {
            ConcurrencyVersion = concurrencyVersion,
            IsFinalized = isFinalized,
            FinalizedAtUtc = finalizedAtUtc,
            FinalizedByUserId = finalizedByUserId
        };
        record.SetUpdatedTimestamp(updatedAtUtc);
        return record;
    }

    public void UpdatePayload(string newSnapshotJson, int expectedVersion, DateTime utcNow)
    {
        EnsureNotFinalized();
        EnsureVersionMatches(expectedVersion);

        SetSnapshotJson(newSnapshotJson);
        ConcurrencyVersion++;
        SetUpdatedTimestamp(utcNow);
    }

    public void Finalize(Guid finalizedByUserId, int expectedVersion, DateTime utcNow)
    {
        EnsureNotFinalized();
        EnsureVersionMatches(expectedVersion);

        if (finalizedByUserId == Guid.Empty)
        {
            throw new ArgumentException("Finalized by user ID cannot be empty GUID.", nameof(finalizedByUserId));
        }

        IsFinalized = true;
        FinalizedByUserId = finalizedByUserId;
        FinalizedAtUtc = utcNow;
        ConcurrencyVersion++;
        SetUpdatedTimestamp(utcNow);
    }

    private void EnsureNotFinalized()
    {
        if (IsFinalized)
        {
            throw new RecordFinalizedException(Id);
        }
    }

    private void EnsureVersionMatches(int expectedVersion)
    {
        if (expectedVersion != ConcurrencyVersion)
        {
            throw new ConcurrencyConflictException(Id, expectedVersion, ConcurrencyVersion);
        }
    }

    private void SetSnapshotJson(string snapshotJson)
    {
        if (string.IsNullOrWhiteSpace(snapshotJson))
        {
            throw new ArgumentException("Snapshot JSON payload cannot be null or whitespace.", nameof(snapshotJson));
        }

        SnapshotJson = snapshotJson.Trim();
    }

    private void SetPayloadVersion(string payloadVersion)
    {
        if (string.IsNullOrWhiteSpace(payloadVersion))
        {
            throw new ArgumentException("Payload version cannot be null or whitespace.", nameof(payloadVersion));
        }

        PayloadVersion = payloadVersion.Trim();
    }
}
