using MedCanvas.Domain.Common;

namespace MedCanvas.Domain.Entities;

/// <summary>
/// Append-only medical audit event recording sensitive clinical read/write/finalize actions.
/// </summary>
public sealed class ClinicalAuditEvent : IAggregateRoot
{
    public Guid Id { get; private set; }
    public Guid ClinicId { get; private set; }
    public Guid? PatientId { get; private set; }
    public Guid? EncounterId { get; private set; }
    public Guid ActorUserId { get; private set; }
    public string Action { get; private set; } = string.Empty;
    public string? ClientIpAddress { get; private set; }
    public string? DetailsHash { get; private set; }
    public DateTime TimestampUtc { get; private set; }

    private ClinicalAuditEvent()
    {
    }

    private ClinicalAuditEvent(
        Guid id,
        Guid clinicId,
        Guid? patientId,
        Guid? encounterId,
        Guid actorUserId,
        string action,
        string? clientIpAddress,
        string? detailsHash,
        DateTime timestampUtc)
    {
        if (id == Guid.Empty)
        {
            throw new ArgumentException("Audit ID cannot be empty GUID.", nameof(id));
        }

        if (clinicId == Guid.Empty)
        {
            throw new ArgumentException("Clinic ID cannot be empty GUID.", nameof(clinicId));
        }

        if (actorUserId == Guid.Empty)
        {
            throw new ArgumentException("Actor user ID cannot be empty GUID.", nameof(actorUserId));
        }

        if (string.IsNullOrWhiteSpace(action))
        {
            throw new ArgumentException("Audit action cannot be null or whitespace.", nameof(action));
        }

        Id = id;
        ClinicId = clinicId;
        PatientId = patientId;
        EncounterId = encounterId;
        ActorUserId = actorUserId;
        Action = action.Trim();
        ClientIpAddress = clientIpAddress?.Trim();
        DetailsHash = detailsHash?.Trim();
        TimestampUtc = timestampUtc;
    }

    public static ClinicalAuditEvent Create(
        Guid clinicId,
        Guid? patientId,
        Guid? encounterId,
        Guid actorUserId,
        string action,
        string? clientIpAddress,
        string? detailsHash,
        DateTime utcNow)
    {
        return new ClinicalAuditEvent(
            Guid.NewGuid(),
            clinicId,
            patientId,
            encounterId,
            actorUserId,
            action,
            clientIpAddress,
            detailsHash,
            utcNow);
    }
}
