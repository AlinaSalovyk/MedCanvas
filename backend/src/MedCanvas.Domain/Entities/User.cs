using MedCanvas.Domain.Common;

namespace MedCanvas.Domain.Entities;

/// <summary>
/// Aggregate root representing an authenticated clinician or staff user.
/// </summary>
public sealed class User : BaseEntity, IAggregateRoot
{
    public string Email { get; private set; } = string.Empty;
    public string FullName { get; private set; } = string.Empty;
    public string PasswordHash { get; private set; } = string.Empty;
    public bool IsActive { get; private set; }

    private User()
    {
    }

    private User(Guid id, string email, string fullName, string passwordHash, DateTime createdAtUtc)
        : base(id, createdAtUtc)
    {
        SetEmail(email);
        SetFullName(fullName);
        SetPasswordHash(passwordHash);
        IsActive = true;
    }

    public static User Create(string email, string fullName, string passwordHash, DateTime utcNow)
    {
        return new User(Guid.NewGuid(), email, fullName, passwordHash, utcNow);
    }

    public static User CreateWithId(Guid id, string email, string fullName, string passwordHash, DateTime utcNow)
    {
        return new User(id, email, fullName, passwordHash, utcNow);
    }

    public void UpdateProfile(string fullName, DateTime utcNow)
    {
        SetFullName(fullName);
        SetUpdatedTimestamp(utcNow);
    }

    public void ChangePassword(string newPasswordHash, DateTime utcNow)
    {
        SetPasswordHash(newPasswordHash);
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

    private void SetEmail(string email)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            throw new ArgumentException("Email cannot be null or whitespace.", nameof(email));
        }

        var normalized = email.Trim().ToLowerInvariant();
        if (!normalized.Contains('@') || normalized.StartsWith('@') || normalized.EndsWith('@'))
        {
            throw new ArgumentException("Email must be a valid email address.", nameof(email));
        }

        Email = normalized;
    }

    private void SetFullName(string fullName)
    {
        if (string.IsNullOrWhiteSpace(fullName))
        {
            throw new ArgumentException("Full name cannot be null or whitespace.", nameof(fullName));
        }

        FullName = fullName.Trim();
    }

    private void SetPasswordHash(string passwordHash)
    {
        if (string.IsNullOrWhiteSpace(passwordHash))
        {
            throw new ArgumentException("Password hash cannot be null or whitespace.", nameof(passwordHash));
        }

        PasswordHash = passwordHash;
    }
}
