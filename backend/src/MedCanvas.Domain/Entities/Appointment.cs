using MedCanvas.Domain.Common;
using MedCanvas.Domain.Enums;
using MedCanvas.Domain.Exceptions;

namespace MedCanvas.Domain.Entities;

/// <summary>
/// Aggregate root: a booked calendar slot for a patient with a clinician on a chair.
/// Overlap invariants (same clinician or same chair within active statuses) are enforced
/// by database exclusion constraints; this aggregate enforces the lifecycle state machine
/// and optimistic concurrency.
/// </summary>
public sealed class Appointment : BaseEntity, IAggregateRoot
{
    private static readonly Dictionary<AppointmentStatus, AppointmentStatus[]> Transitions = new()
    {
        [AppointmentStatus.Scheduled] = [AppointmentStatus.Confirmed, AppointmentStatus.Cancelled, AppointmentStatus.NoShow],
        [AppointmentStatus.Confirmed] = [AppointmentStatus.Arrived, AppointmentStatus.Cancelled, AppointmentStatus.NoShow],
        [AppointmentStatus.Arrived] = [AppointmentStatus.InProgress, AppointmentStatus.Completed, AppointmentStatus.Cancelled],
        [AppointmentStatus.InProgress] = [AppointmentStatus.Completed],
        [AppointmentStatus.Completed] = [],
        [AppointmentStatus.Cancelled] = [],
        [AppointmentStatus.NoShow] = [],
    };

    public Guid ClinicId { get; private set; }
    public Guid PatientId { get; private set; }
    public Guid ClinicianUserId { get; private set; }
    public Guid ChairId { get; private set; }
    public DateTime StartAtUtc { get; private set; }
    public DateTime EndAtUtc { get; private set; }
    public AppointmentStatus Status { get; private set; }
    public string ReasonForVisit { get; private set; } = string.Empty;
    public string? InternalNote { get; private set; }
    public string? CancellationReason { get; private set; }
    public int ConcurrencyVersion { get; private set; }

    /// <summary>Statuses that occupy a clinician/chair slot (cancellable-free rebooking excluded).</summary>
    public bool OccupiesSlot => Status is AppointmentStatus.Scheduled
        or AppointmentStatus.Confirmed
        or AppointmentStatus.Arrived
        or AppointmentStatus.InProgress;

    private Appointment()
    {
    }

    private Appointment(
        Guid id,
        Guid clinicId,
        Guid patientId,
        Guid clinicianUserId,
        Guid chairId,
        DateTime startAtUtc,
        DateTime endAtUtc,
        string reasonForVisit,
        string? internalNote,
        DateTime createdAtUtc)
        : base(id, createdAtUtc)
    {
        if (clinicId == Guid.Empty) throw new ArgumentException("Clinic ID cannot be empty GUID.", nameof(clinicId));
        if (patientId == Guid.Empty) throw new ArgumentException("Patient ID cannot be empty GUID.", nameof(patientId));
        if (clinicianUserId == Guid.Empty) throw new ArgumentException("Clinician user ID cannot be empty GUID.", nameof(clinicianUserId));
        if (chairId == Guid.Empty) throw new ArgumentException("Chair ID cannot be empty GUID.", nameof(chairId));
        SetTimeRange(startAtUtc, endAtUtc);
        SetReason(reasonForVisit);
        ClinicId = clinicId;
        PatientId = patientId;
        ClinicianUserId = clinicianUserId;
        ChairId = chairId;
        InternalNote = internalNote?.Trim();
        Status = AppointmentStatus.Scheduled;
        ConcurrencyVersion = 1;
    }

    public static Appointment Create(
        Guid clinicId,
        Guid patientId,
        Guid clinicianUserId,
        Guid chairId,
        DateTime startAtUtc,
        DateTime endAtUtc,
        string reasonForVisit,
        string? internalNote,
        DateTime utcNow)
    {
        return new Appointment(Guid.NewGuid(), clinicId, patientId, clinicianUserId, chairId, startAtUtc, endAtUtc, reasonForVisit, internalNote, utcNow);
    }

    public static Appointment CreateWithId(
        Guid id,
        Guid clinicId,
        Guid patientId,
        Guid clinicianUserId,
        Guid chairId,
        DateTime startAtUtc,
        DateTime endAtUtc,
        string reasonForVisit,
        string? internalNote,
        DateTime utcNow)
    {
        return new Appointment(id, clinicId, patientId, clinicianUserId, chairId, startAtUtc, endAtUtc, reasonForVisit, internalNote, utcNow);
    }

    public void Confirm(DateTime utcNow) => TransitionTo(AppointmentStatus.Confirmed, utcNow);

    public void MarkArrived(DateTime utcNow) => TransitionTo(AppointmentStatus.Arrived, utcNow);

    public void StartInProgress(DateTime utcNow) => TransitionTo(AppointmentStatus.InProgress, utcNow);

    public void Complete(DateTime utcNow) => TransitionTo(AppointmentStatus.Completed, utcNow);

    public void MarkNoShow(DateTime utcNow) => TransitionTo(AppointmentStatus.NoShow, utcNow);

    public void Cancel(string reason, DateTime utcNow)
    {
        if (string.IsNullOrWhiteSpace(reason))
        {
            throw new ArgumentException("Cancellation reason is required.", nameof(reason));
        }

        TransitionTo(AppointmentStatus.Cancelled, utcNow);
        CancellationReason = reason.Trim();
    }

    /// <summary>Move the slot in time (and optionally to another chair). Only from Scheduled/Confirmed.</summary>
    public void Reschedule(DateTime newStartUtc, DateTime newEndUtc, Guid? newChairId, int expectedVersion, DateTime utcNow)
    {
        EnsureVersionMatches(expectedVersion);
        if (Status is not (AppointmentStatus.Scheduled or AppointmentStatus.Confirmed))
        {
            throw new DomainException($"Appointment in status '{Status}' cannot be rescheduled.");
        }

        SetTimeRange(newStartUtc, newEndUtc);
        if (newChairId.HasValue)
        {
            if (newChairId.Value == Guid.Empty)
            {
                throw new ArgumentException("Chair ID cannot be empty GUID.", nameof(newChairId));
            }
            ChairId = newChairId.Value;
        }

        ConcurrencyVersion++;
        SetUpdatedTimestamp(utcNow);
    }

    /// <summary>Update the internal note while the appointment is still upcoming.</summary>
    public void UpdateInternalNote(string? note, int expectedVersion, DateTime utcNow)
    {
        EnsureVersionMatches(expectedVersion);
        InternalNote = note?.Trim();
        ConcurrencyVersion++;
        SetUpdatedTimestamp(utcNow);
    }

    private void TransitionTo(AppointmentStatus target, DateTime utcNow)
    {
        if (!Transitions[Status].Contains(target))
        {
            throw new DomainException($"Invalid appointment transition: '{Status}' → '{target}'.");
        }

        Status = target;
        SetUpdatedTimestamp(utcNow);
    }

    private void SetTimeRange(DateTime startAtUtc, DateTime endAtUtc)
    {
        if (startAtUtc.Kind != DateTimeKind.Utc || endAtUtc.Kind != DateTimeKind.Utc)
        {
            throw new ArgumentException("Appointment times must be UTC.", nameof(startAtUtc));
        }

        if (endAtUtc <= startAtUtc)
        {
            throw new DomainException("Appointment end must be after its start.");
        }

        if (endAtUtc - startAtUtc > TimeSpan.FromHours(8))
        {
            throw new DomainException("Appointment duration cannot exceed 8 hours.");
        }

        StartAtUtc = startAtUtc;
        EndAtUtc = endAtUtc;
    }

    private void SetReason(string reasonForVisit)
    {
        if (string.IsNullOrWhiteSpace(reasonForVisit))
        {
            throw new ArgumentException("Reason for visit is required.", nameof(reasonForVisit));
        }

        ReasonForVisit = reasonForVisit.Trim();
    }

    private void EnsureVersionMatches(int expectedVersion)
    {
        if (expectedVersion != ConcurrencyVersion)
        {
            throw new ConcurrencyConflictException(Id, expectedVersion, ConcurrencyVersion);
        }
    }
}
