using MedCanvas.Domain.Common;

namespace MedCanvas.Domain.Entities;

/// <summary>
/// Aggregate root representing an isolated clinic tenant.
/// </summary>
public sealed class Clinic : BaseEntity, IAggregateRoot
{
    public string Name { get; private set; } = string.Empty;
    public string Identifier { get; private set; } = string.Empty;
    public bool IsActive { get; private set; }

    private Clinic()
    {
    }

    private Clinic(Guid id, string name, string identifier, DateTime createdAtUtc)
        : base(id, createdAtUtc)
    {
        SetName(name);
        SetIdentifier(identifier);
        IsActive = true;
    }

    public static Clinic Create(string name, string identifier, DateTime utcNow)
    {
        return new Clinic(Guid.NewGuid(), name, identifier, utcNow);
    }

    public static Clinic CreateWithId(Guid id, string name, string identifier, DateTime utcNow)
    {
        return new Clinic(id, name, identifier, utcNow);
    }

    public void Update(string name, string identifier, DateTime utcNow)
    {
        SetName(name);
        SetIdentifier(identifier);
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

    private void SetName(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new ArgumentException("Clinic name cannot be null or whitespace.", nameof(name));
        }

        Name = name.Trim();
    }

    private void SetIdentifier(string identifier)
    {
        if (string.IsNullOrWhiteSpace(identifier))
        {
            throw new ArgumentException("Clinic identifier cannot be null or whitespace.", nameof(identifier));
        }

        Identifier = identifier.Trim().ToUpperInvariant();
    }
}
