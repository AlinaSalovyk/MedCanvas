using MedCanvas.Domain.Common;

namespace MedCanvas.Domain.Entities;

/// <summary>
/// One planned line of a treatment plan. The unit price is snapshotted at insertion
/// (FR-405); totals are computed server-side (INV-007).
/// </summary>
public sealed class TreatmentPlanItem : BaseEntity
{
    public Guid TreatmentPlanId { get; private set; }
    public Guid ProcedureCatalogItemId { get; private set; }
    public string? ToothFdi { get; private set; }
    public string? Surface { get; private set; }
    public string? Phase { get; private set; }
    public int Quantity { get; private set; }
    public decimal UnitPriceSnapshot { get; private set; }
    public decimal TotalAmount { get; private set; }
    public string? Notes { get; private set; }

    private TreatmentPlanItem()
    {
    }

    private TreatmentPlanItem(
        Guid id,
        Guid treatmentPlanId,
        Guid procedureCatalogItemId,
        string? toothFdi,
        string? surface,
        string? phase,
        int quantity,
        decimal unitPriceSnapshot,
        DateTime createdAtUtc,
        string? notes)
        : base(id, createdAtUtc)
    {
        if (treatmentPlanId == Guid.Empty) throw new ArgumentException("Treatment plan ID cannot be empty GUID.", nameof(treatmentPlanId));
        if (procedureCatalogItemId == Guid.Empty) throw new ArgumentException("Catalog item ID cannot be empty GUID.", nameof(procedureCatalogItemId));

        SetTooth(toothFdi);
        SetSurface(surface);
        SetQuantity(quantity);
        SetPrice(unitPriceSnapshot);

        TreatmentPlanId = treatmentPlanId;
        ProcedureCatalogItemId = procedureCatalogItemId;
        Phase = phase?.Trim();
        Notes = notes?.Trim();
        TotalAmount = ComputeTotal(Quantity, UnitPriceSnapshot);
    }

    public static TreatmentPlanItem Create(
        Guid id,
        Guid treatmentPlanId,
        Guid procedureCatalogItemId,
        string? toothFdi,
        string? surface,
        string? phase,
        int quantity,
        decimal unitPriceSnapshot,
        DateTime createdAtUtc,
        string? notes) =>
        new(id, treatmentPlanId, procedureCatalogItemId, toothFdi, surface, phase, quantity, unitPriceSnapshot, createdAtUtc, notes);

    internal static decimal ComputeTotal(int quantity, decimal unitPrice) =>
        decimal.Round(quantity * unitPrice, 2, MidpointRounding.ToEven);

    private void SetTooth(string? toothFdi)
    {
        if (string.IsNullOrWhiteSpace(toothFdi))
        {
            ToothFdi = null;
            return;
        }

        var trimmed = toothFdi.Trim();
        if (!System.Text.RegularExpressions.Regex.IsMatch(trimmed, "^(?:[1-4][1-8]|5[1-5]|[6-8][1-5])$"))
        {
            throw new ArgumentException($"Tooth FDI '{toothFdi}' is not a valid ISO 3950 tooth number.", nameof(toothFdi));
        }

        ToothFdi = trimmed;
    }

    private void SetSurface(string? surface)
    {
        if (string.IsNullOrWhiteSpace(surface))
        {
            Surface = null;
            return;
        }

        var trimmed = surface.Trim().ToLowerInvariant();
        if (trimmed is not ("occlusal" or "mesial" or "distal" or "vestibular" or "lingual"))
        {
            throw new ArgumentException($"Surface '{surface}' is not a valid tooth surface.", nameof(surface));
        }

        Surface = trimmed;
    }

    private void SetQuantity(int quantity)
    {
        if (quantity is < 1 or > 20)
        {
            throw new ArgumentException("Quantity must be between 1 and 20.", nameof(quantity));
        }

        Quantity = quantity;
    }

    private void SetPrice(decimal unitPriceSnapshot)
    {
        if (unitPriceSnapshot < 0)
        {
            throw new ArgumentException("Unit price snapshot cannot be negative.", nameof(unitPriceSnapshot));
        }

        UnitPriceSnapshot = decimal.Round(unitPriceSnapshot, 2, MidpointRounding.ToEven);
    }
}
