using MedCanvas.Domain.Common;
using MedCanvas.Domain.Enums;
using MedCanvas.Domain.Exceptions;

namespace MedCanvas.Domain.Entities;

/// <summary>
/// Aggregate root representing a clinical examination session for a patient.
/// </summary>
public sealed class DentalEncounter : BaseEntity, IAggregateRoot
{
    public Guid ClinicId { get; private set; }
    public Guid PatientId { get; private set; }
    public Guid AttendingUserId { get; private set; }
    public DateTime EncounterDateUtc { get; private set; }
    public string? ChiefComplaint { get; private set; }
    public string? ClinicalNotes { get; private set; }
    public EncounterStatus Status { get; private set; }

    private DentalEncounter()
    {
    }

    private DentalEncounter(
        Guid id,
        Guid clinicId,
        Guid patientId,
        Guid attendingUserId,
        DateTime encounterDateUtc,
        string? chiefComplaint,
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

        if (attendingUserId == Guid.Empty)
        {
            throw new ArgumentException("Attending user ID cannot be empty GUID.", nameof(attendingUserId));
        }

        ClinicId = clinicId;
        PatientId = patientId;
        AttendingUserId = attendingUserId;
        EncounterDateUtc = encounterDateUtc;
        ChiefComplaint = chiefComplaint?.Trim();
        Status = EncounterStatus.InProgress;
    }

    public static DentalEncounter Start(
        Guid clinicId,
        Guid patientId,
        Guid attendingUserId,
        DateTime encounterDateUtc,
        string? chiefComplaint,
        DateTime utcNow)
    {
        return new DentalEncounter(
            Guid.NewGuid(),
            clinicId,
            patientId,
            attendingUserId,
            encounterDateUtc,
            chiefComplaint,
            utcNow);
    }

    public static DentalEncounter CreateWithId(
        Guid id,
        Guid clinicId,
        Guid patientId,
        Guid attendingUserId,
        DateTime encounterDateUtc,
        string? chiefComplaint,
        DateTime createdAtUtc)
    {
        return new DentalEncounter(
            id,
            clinicId,
            patientId,
            attendingUserId,
            encounterDateUtc,
            chiefComplaint,
            createdAtUtc);
    }

    public void UpdateNotes(string? chiefComplaint, string? clinicalNotes, DateTime utcNow)
    {
        EnsureNotFinished();
        ChiefComplaint = chiefComplaint?.Trim();
        ClinicalNotes = clinicalNotes?.Trim();
        SetUpdatedTimestamp(utcNow);
    }

    public void Complete(DateTime utcNow, string? clinicalSummary = null)
    {
        EnsureNotFinished();
        if (!string.IsNullOrWhiteSpace(clinicalSummary))
        {
            ClinicalNotes = string.IsNullOrWhiteSpace(ClinicalNotes)
                ? clinicalSummary.Trim()
                : $"{ClinicalNotes}\n{clinicalSummary.Trim()}";
        }
        Status = EncounterStatus.Completed;
        SetUpdatedTimestamp(utcNow);
    }

    public void Cancel(string reason, DateTime utcNow)
    {
        EnsureNotFinished();
        if (string.IsNullOrWhiteSpace(reason))
        {
            throw new ArgumentException("Cancellation reason must be provided.", nameof(reason));
        }

        ClinicalNotes = string.IsNullOrWhiteSpace(ClinicalNotes)
            ? $"[CANCELLED: {reason.Trim()}]"
            : $"{ClinicalNotes}\n[CANCELLED: {reason.Trim()}]";

        Status = EncounterStatus.Cancelled;
        SetUpdatedTimestamp(utcNow);
    }

    private void EnsureNotFinished()
    {
        if (Status is EncounterStatus.Completed or EncounterStatus.Cancelled)
        {
            throw new InvalidOperationException($"Encounter is in '{Status}' state and cannot be modified.");
        }
    }
}
