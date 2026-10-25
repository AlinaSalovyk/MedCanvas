using MedCanvas.Domain.Common;

namespace MedCanvas.Domain.Entities;

/// <summary>A billable procedure in a clinic's price list (M05). Prices are decimal UAH.</summary>
public sealed class ProcedureCatalogItem : BaseEntity, IAggregateRoot
{
    public Guid ClinicId { get; private set; }
    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public string? Category { get; private set; }
    public decimal DefaultPrice { get; private set; }
    public int EstimatedDurationMinutes { get; private set; }
    public bool IsActive { get; private set; }

    private ProcedureCatalogItem()
    {
    }

    private ProcedureCatalogItem(
        Guid id,
        Guid clinicId,
        string code,
        string name,
        string? description,
        string? category,
        decimal defaultPrice,
        int estimatedDurationMinutes,
        DateTime createdAtUtc)
        : base(id, createdAtUtc)
    {
        if (clinicId == Guid.Empty)
        {
            throw new ArgumentException("Clinic ID cannot be empty GUID.", nameof(clinicId));
        }

        SetCode(code);
        SetName(name);
        ClinicId = clinicId;
        Description = description?.Trim();
        Category = category?.Trim();
        SetPrice(defaultPrice);
        SetDuration(estimatedDurationMinutes);
        IsActive = true;
    }

    public static ProcedureCatalogItem Create(
        Guid clinicId, string code, string name, string? description, string? category,
        decimal defaultPrice, int estimatedDurationMinutes, DateTime utcNow) =>
        new(Guid.NewGuid(), clinicId, code, name, description, category, defaultPrice, estimatedDurationMinutes, utcNow);

    public void Update(string name, string? description, string? category, decimal defaultPrice, int estimatedDurationMinutes, DateTime utcNow)
    {
        SetName(name);
        Description = description?.Trim();
        Category = category?.Trim();
        SetPrice(defaultPrice);
        SetDuration(estimatedDurationMinutes);
        SetUpdatedTimestamp(utcNow);
    }

    public void Deactivate(DateTime utcNow)
    {
        IsActive = false;
        SetUpdatedTimestamp(utcNow);
    }

    public void Activate(DateTime utcNow)
    {
        IsActive = true;
        SetUpdatedTimestamp(utcNow);
    }

    private void SetCode(string code)
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            throw new ArgumentException("Catalog code is required.", nameof(code));
        }

        Code = code.Trim().ToUpperInvariant();
    }

    private void SetName(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new ArgumentException("Catalog name is required.", nameof(name));
        }

        Name = name.Trim();
    }

    private void SetPrice(decimal price)
    {
        if (price < 0)
        {
            throw new ArgumentException("Catalog price cannot be negative.", nameof(price));
        }

        DefaultPrice = decimal.Round(price, 2, MidpointRounding.ToEven);
    }

    private void SetDuration(int minutes)
    {
        if (minutes is < 0 or > 600)
        {
            throw new ArgumentException("Estimated duration must be between 0 and 600 minutes.", nameof(minutes));
        }

        EstimatedDurationMinutes = minutes;
    }
}
