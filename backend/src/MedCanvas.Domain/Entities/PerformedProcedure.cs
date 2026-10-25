using MedCanvas.Domain.Common;
using MedCanvas.Domain.Enums;

namespace MedCanvas.Domain.Entities;

/// <summary>
/// A procedure a clinician actually performed (M06). Recorded only by explicit
/// clinician action (INV-006); corrections are compensating voids — history is
/// never rewritten (FR-506). Network retries are idempotent via IdempotencyKey (FR-505).
/// </summary>
public sealed class PerformedProcedure : BaseEntity, IAggregateRoot
{
    public Guid ClinicId { get; private set; }
    public Guid PatientId { get; private set; }
    public Guid EncounterId { get; private set; }
    public Guid? TreatmentPlanItemId { get; private set; }
    public Guid ProcedureCatalogItemId { get; private set; }
    public string? ToothFdi { get; private set; }
    public int Quantity { get; private set; }
    public Guid PerformedByUserId { get; private set; }
    public decimal UnitPriceSnapshot { get; private set; }
    public decimal TotalAmount { get; private set; }
    public string? ClinicalNote { get; private set; }
    public string IdempotencyKey { get; private set; } = string.Empty;
    public PerformedProcedureStatus Status { get; private set; }
    public string? VoidReason { get; private set; }
    public Guid? VoidedByUserId { get; private set; }
    public DateTime? VoidedAtUtc { get; private set; }

    private PerformedProcedure()
    {
    }

    private PerformedProcedure(
        Guid id,
        Guid clinicId,
        Guid patientId,
        Guid encounterId,
        Guid? treatmentPlanItemId,
        Guid procedureCatalogItemId,
        string? toothFdi,
        int quantity,
        Guid performedByUserId,
        decimal unitPriceSnapshot,
        string? clinicalNote,
        string idempotencyKey,
        DateTime createdAtUtc)
        : base(id, createdAtUtc)
    {
        if (clinicId == Guid.Empty) throw new ArgumentException("Clinic ID cannot be empty GUID.", nameof(clinicId));
        if (patientId == Guid.Empty) throw new ArgumentException("Patient ID cannot be empty GUID.", nameof(patientId));
        if (encounterId == Guid.Empty) throw new ArgumentException("Encounter ID cannot be empty GUID.", nameof(encounterId));
        if (treatmentPlanItemId == Guid.Empty) throw new ArgumentException("Treatment plan item ID cannot be empty GUID when provided.", nameof(treatmentPlanItemId));
        if (procedureCatalogItemId == Guid.Empty) throw new ArgumentException("Catalog item ID cannot be empty GUID.", nameof(procedureCatalogItemId));
        if (performedByUserId == Guid.Empty) throw new ArgumentException("Performer user ID cannot be empty GUID.", nameof(performedByUserId));
        if (quantity is < 1 or > 20) throw new ArgumentException("Quantity must be between 1 and 20.", nameof(quantity));
        if (string.IsNullOrWhiteSpace(idempotencyKey)) throw new ArgumentException("Idempotency key is required.", nameof(idempotencyKey));
        if (unitPriceSnapshot < 0) throw new ArgumentException("Unit price snapshot cannot be negative.", nameof(unitPriceSnapshot));

        ToothFdi = string.IsNullOrWhiteSpace(toothFdi) ? null : toothFdi.Trim();

        ClinicId = clinicId;
        PatientId = patientId;
        EncounterId = encounterId;
        TreatmentPlanItemId = treatmentPlanItemId;
        ProcedureCatalogItemId = procedureCatalogItemId;
        Quantity = quantity;
        PerformedByUserId = performedByUserId;
        UnitPriceSnapshot = decimal.Round(unitPriceSnapshot, 2, MidpointRounding.ToEven);
        TotalAmount = decimal.Round(quantity * UnitPriceSnapshot, 2, MidpointRounding.ToEven);
        ClinicalNote = clinicalNote?.Trim();
        IdempotencyKey = idempotencyKey.Trim();
        Status = PerformedProcedureStatus.Recorded;
    }

    public static PerformedProcedure Record(
        Guid clinicId,
        Guid patientId,
        Guid encounterId,
        Guid? treatmentPlanItemId,
        Guid procedureCatalogItemId,
        string? toothFdi,
        int quantity,
        Guid performedByUserId,
        decimal unitPriceSnapshot,
        string? clinicalNote,
        string idempotencyKey,
        DateTime utcNow) =>
        new(Guid.NewGuid(), clinicId, patientId, encounterId, treatmentPlanItemId, procedureCatalogItemId,
            toothFdi, quantity, performedByUserId, unitPriceSnapshot, clinicalNote, idempotencyKey, utcNow);

    /// <summary>Controlled correction: void with a mandatory reason; the record stays visible (FR-506).</summary>
    public void Void(Guid voidedByUserId, string reason, DateTime utcNow)
    {
        if (Status != PerformedProcedureStatus.Recorded)
        {
            throw new Domain.Exceptions.DomainException($"Performed procedure in status '{Status}' cannot be voided again.");
        }

        if (string.IsNullOrWhiteSpace(reason))
        {
            throw new ArgumentException("Void reason is required.", nameof(reason));
        }

        if (voidedByUserId == Guid.Empty)
        {
            throw new ArgumentException("Voiding user ID cannot be empty GUID.", nameof(voidedByUserId));
        }

        Status = PerformedProcedureStatus.Voided;
        VoidedByUserId = voidedByUserId;
        VoidedAtUtc = utcNow;
        VoidReason = reason.Trim();
        SetUpdatedTimestamp(utcNow);
    }
}
