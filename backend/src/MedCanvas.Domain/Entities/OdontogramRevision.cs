using MedCanvas.Domain.Common;

namespace MedCanvas.Domain.Entities;

/// <summary>
/// Immutable historical revision of an OdontogramRecord snapshot.
/// </summary>
public sealed class OdontogramRevision : BaseEntity
{
    public Guid OdontogramRecordId { get; private set; }
    public Guid ClinicId { get; private set; }
    public Guid PatientId { get; private set; }
    public Guid EncounterId { get; private set; }
    public int RevisionNumber { get; private set; }
    public string SnapshotJson { get; private set; } = string.Empty;
    public Guid CreatedByUserId { get; private set; }
    public string? ChangeSummary { get; private set; }

    private OdontogramRevision()
    {
    }

    private OdontogramRevision(
        Guid id,
        Guid odontogramRecordId,
        Guid clinicId,
        Guid patientId,
        Guid encounterId,
        int revisionNumber,
        string snapshotJson,
        Guid createdByUserId,
        string? changeSummary,
        DateTime createdAtUtc)
        : base(id, createdAtUtc)
    {
        if (odontogramRecordId == Guid.Empty)
        {
            throw new ArgumentException("Odontogram record ID cannot be empty GUID.", nameof(odontogramRecordId));
        }

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

        if (createdByUserId == Guid.Empty)
        {
            throw new ArgumentException("Created by user ID cannot be empty GUID.", nameof(createdByUserId));
        }

        if (revisionNumber < 1)
        {
            throw new ArgumentException("Revision number must be positive (>= 1).", nameof(revisionNumber));
        }

        if (string.IsNullOrWhiteSpace(snapshotJson))
        {
            throw new ArgumentException("Snapshot JSON payload cannot be null or whitespace.", nameof(snapshotJson));
        }

        OdontogramRecordId = odontogramRecordId;
        ClinicId = clinicId;
        PatientId = patientId;
        EncounterId = encounterId;
        RevisionNumber = revisionNumber;
        SnapshotJson = snapshotJson.Trim();
        CreatedByUserId = createdByUserId;
        ChangeSummary = changeSummary?.Trim();
    }

    public static OdontogramRevision Create(
        OdontogramRecord record,
        int revisionNumber,
        Guid createdByUserId,
        string? changeSummary,
        DateTime utcNow)
    {
        if (record is null)
        {
            throw new ArgumentNullException(nameof(record));
        }

        return new OdontogramRevision(
            Guid.NewGuid(),
            record.Id,
            record.ClinicId,
            record.PatientId,
            record.EncounterId,
            revisionNumber,
            record.SnapshotJson,
            createdByUserId,
            changeSummary,
            utcNow);
    }

    public static OdontogramRevision CreateWithId(
        Guid id,
        Guid odontogramRecordId,
        Guid clinicId,
        Guid patientId,
        Guid encounterId,
        int revisionNumber,
        string snapshotJson,
        Guid createdByUserId,
        string? changeSummary,
        DateTime createdAtUtc)
    {
        return new OdontogramRevision(
            id,
            odontogramRecordId,
            clinicId,
            patientId,
            encounterId,
            revisionNumber,
            snapshotJson,
            createdByUserId,
            changeSummary,
            createdAtUtc);
    }
}
