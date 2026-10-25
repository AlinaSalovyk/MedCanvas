using MedCanvas.Domain.Common;

namespace MedCanvas.Domain.Entities;

/// <summary>
/// Aggregate root representing an isolated clinic tenant.
/// </summary>
public sealed class Clinic : BaseEntity, IAggregateRoot
{
    public string Name { get; private set; } = string.Empty;
    public string Identifier { get; private set; } = string.Empty;
    public string TimeZoneId { get; private set; } = "Europe/Kyiv";
    public bool IsActive { get; private set; }

    private Clinic()
    {
    }

    private Clinic(Guid id, string name, string identifier, DateTime createdAtUtc, string timeZoneId)
        : base(id, createdAtUtc)
    {
        SetName(name);
        SetIdentifier(identifier);
        SetTimeZoneId(timeZoneId);
        IsActive = true;
    }

    public static Clinic Create(string name, string identifier, DateTime utcNow, string timeZoneId = "Europe/Kyiv")
    {
        return new Clinic(Guid.NewGuid(), name, identifier, utcNow, timeZoneId);
    }

    public static Clinic CreateWithId(Guid id, string name, string identifier, DateTime utcNow, string timeZoneId = "Europe/Kyiv")
    {
        return new Clinic(id, name, identifier, utcNow, timeZoneId);
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

    /// <summary>
    /// Update the clinic's editable profile fields. The business <see cref="Identifier"/>
    /// is immutable after onboarding (unique external identity).
    /// </summary>
    public void UpdateProfile(string name, string timeZoneId, DateTime utcNow)
    {
        SetName(name);
        SetTimeZoneId(timeZoneId);
        SetUpdatedTimestamp(utcNow);
    }

    private void SetIdentifier(string identifier)
    {
        if (string.IsNullOrWhiteSpace(identifier))
        {
            throw new ArgumentException("Clinic identifier cannot be null or whitespace.", nameof(identifier));
        }

        Identifier = identifier.Trim().ToUpperInvariant();
    }

    private void SetTimeZoneId(string timeZoneId)
    {
        if (string.IsNullOrWhiteSpace(timeZoneId))
        {
            throw new ArgumentException("Clinic time zone identifier cannot be null or whitespace.", nameof(timeZoneId));
        }

        if (TimeZoneInfo.TryFindSystemTimeZoneById(timeZoneId.Trim(), out _))
        {
            TimeZoneId = timeZoneId.Trim();
            return;
        }

        throw new ArgumentException($"Clinic time zone identifier '{timeZoneId}' is not a known IANA time zone.", nameof(timeZoneId));
    }
}
