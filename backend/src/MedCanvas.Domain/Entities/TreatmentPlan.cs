using MedCanvas.Domain.Common;
using MedCanvas.Domain.Enums;
using MedCanvas.Domain.Exceptions;

namespace MedCanvas.Domain.Entities;

/// <summary>
/// Aggregate root: a structured treatment plan for a patient (M05). Items carry a
/// price snapshot at insertion; catalog changes never mutate an existing plan (FR-405).
/// Approval locks the terms (FR-407); lifecycle is a server-enforced state machine.
/// </summary>
public sealed class TreatmentPlan : BaseEntity, IAggregateRoot
{
    public Guid ClinicId { get; private set; }
    public Guid PatientId { get; private set; }
    public Guid SourceEncounterId { get; private set; }
    public Guid CreatedByUserId { get; private set; }
    public TreatmentPlanStatus Status { get; private set; }
    public int Version { get; private set; }
    public DateTime? ApprovedAtUtc { get; private set; }
    public Guid? ApprovedByUserId { get; private set; }

    private readonly List<TreatmentPlanItem> _items = [];
    public IReadOnlyList<TreatmentPlanItem> Items => _items;

    private TreatmentPlan()
    {
    }

    private TreatmentPlan(
        Guid id,
        Guid clinicId,
        Guid patientId,
        Guid sourceEncounterId,
        Guid createdByUserId,
        DateTime createdAtUtc)
        : base(id, createdAtUtc)
    {
        if (clinicId == Guid.Empty) throw new ArgumentException("Clinic ID cannot be empty GUID.", nameof(clinicId));
        if (patientId == Guid.Empty) throw new ArgumentException("Patient ID cannot be empty GUID.", nameof(patientId));
        if (sourceEncounterId == Guid.Empty) throw new ArgumentException("Source encounter ID cannot be empty GUID.", nameof(sourceEncounterId));
        if (createdByUserId == Guid.Empty) throw new ArgumentException("Creator user ID cannot be empty GUID.", nameof(createdByUserId));

        ClinicId = clinicId;
        PatientId = patientId;
        SourceEncounterId = sourceEncounterId;
        CreatedByUserId = createdByUserId;
        Status = TreatmentPlanStatus.Draft;
        Version = 1;
    }

    public static TreatmentPlan Create(
        Guid clinicId, Guid patientId, Guid sourceEncounterId, Guid createdByUserId, DateTime utcNow) =>
        new(Guid.NewGuid(), clinicId, patientId, sourceEncounterId, createdByUserId, utcNow);

    public TreatmentPlanItem AddItem(
        ProcedureCatalogItem catalogItem,
        string? toothFdi,
        string? surface,
        string? phase,
        int quantity,
        string? notes,
        DateTime utcNow)
    {
        EnsureNotSealed("Items can only be added to a Draft plan.");

        var item = TreatmentPlanItem.Create(
            Guid.NewGuid(),
            Id,
            catalogItem.Id,
            toothFdi,
            surface,
            phase,
            quantity,
            catalogItem.DefaultPrice,
            utcNow,
            notes);

        _items.Add(item);
        Version++;
        SetUpdatedTimestamp(utcNow);
        return item;
    }

    public void RemoveItem(Guid itemId, DateTime utcNow)
    {
        EnsureNotSealed("Items can only be removed from a Draft plan.");

        var item = _items.FirstOrDefault(i => i.Id == itemId);
        if (item == null)
        {
            throw new DomainException($"Treatment plan item '{itemId}' was not found on this plan.");
        }

        _items.Remove(item);
        Version++;
        SetUpdatedTimestamp(utcNow);
    }

    /// <summary>Draft → Proposed. Requires at least one item (FR-407: no empty approvals).</summary>
    public void SubmitForApproval(DateTime utcNow)
    {
        if (Status != TreatmentPlanStatus.Draft)
        {
            throw new DomainException($"Treatment plan in status '{Status}' cannot be submitted for approval.");
        }

        if (_items.Count == 0)
        {
            throw new DomainException("An empty treatment plan cannot be submitted for approval.");
        }

        Status = TreatmentPlanStatus.Proposed;
        SetUpdatedTimestamp(utcNow);
    }

    /// <summary>Proposed → Approved. Locks the agreed terms (price snapshots frozen).</summary>
    public void Approve(Guid approverUserId, DateTime utcNow)
    {
        if (Status != TreatmentPlanStatus.Proposed)
        {
            throw new DomainException($"Treatment plan in status '{Status}' cannot be approved.");
        }

        if (_items.Count == 0)
        {
            throw new DomainException("An empty treatment plan cannot be approved.");
        }

        if (approverUserId == Guid.Empty)
        {
            throw new ArgumentException("Approver user ID cannot be empty GUID.", nameof(approverUserId));
        }

        Status = TreatmentPlanStatus.Approved;
        ApprovedAtUtc = utcNow;
        ApprovedByUserId = approverUserId;
        SetUpdatedTimestamp(utcNow);
    }

    /// <summary>First performed item moves an Approved plan into InProgress (INV-006:
    /// execution only via explicit recordings, never from the visual chart).</summary>
    public void NotifyExecutionStarted(DateTime utcNow)
    {
        if (Status == TreatmentPlanStatus.Approved)
        {
            Status = TreatmentPlanStatus.InProgress;
            SetUpdatedTimestamp(utcNow);
        }
    }

    /// <summary>Mark a plan item performed. Idempotent per item; only meaningful for
    /// Approved/InProgress plans.</summary>
    public void MarkItemPerformed(Guid itemId, DateTime utcNow)
    {
        if (Status is not (TreatmentPlanStatus.Approved or TreatmentPlanStatus.InProgress))
        {
            throw new DomainException($"Treatment plan in status '{Status}' cannot record execution.");
        }

        var item = _items.FirstOrDefault(i => i.Id == itemId);
        if (item == null)
        {
            throw new DomainException($"Treatment plan item '{itemId}' was not found on this plan.");
        }

        item.MarkPerformed(utcNow);
        SetUpdatedTimestamp(utcNow);
    }

    public void Cancel(DateTime utcNow)
    {
        if (Status is TreatmentPlanStatus.Completed or TreatmentPlanStatus.Cancelled)
        {
            throw new DomainException($"Treatment plan in status '{Status}' cannot be cancelled.");
        }

        Status = TreatmentPlanStatus.Cancelled;
        SetUpdatedTimestamp(utcNow);
    }

    public decimal EstimateTotal() => _items.Sum(i => i.TotalAmount);

    private void EnsureNotSealed(string message)
    {
        if (Status != TreatmentPlanStatus.Draft)
        {
            throw new DomainException(message);
        }
    }
}
