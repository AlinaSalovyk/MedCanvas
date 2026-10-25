using MedCanvas.Domain.Common;
using MedCanvas.Domain.Exceptions;

namespace MedCanvas.Domain.Entities;

/// <summary>
/// Aggregate root representing a patient under care in a specific clinic.
/// </summary>
public sealed class Patient : BaseEntity, IAggregateRoot
{
    public Guid ClinicId { get; private set; }
    public string? ExternalMedicalRecordNumber { get; private set; }
    public string FirstName { get; private set; } = string.Empty;
    public string LastName { get; private set; } = string.Empty;
    public DateOnly? DateOfBirth { get; private set; }
    public string? Gender { get; private set; }
    public string? Phone { get; private set; }
    public string? Email { get; private set; }
    public string? MedicalAlerts { get; private set; }
    public bool IsActive { get; private set; }
    public int ConcurrencyVersion { get; private set; }

    public string FullName => $"{FirstName} {LastName}".Trim();

    private Patient()
    {
    }

    private Patient(
        Guid id,
        Guid clinicId,
        string firstName,
        string lastName,
        DateOnly? dateOfBirth,
        string? gender,
        string? phone,
        string? email,
        string? externalMrn,
        string? medicalAlerts,
        DateTime createdAtUtc)
        : base(id, createdAtUtc)
    {
        if (clinicId == Guid.Empty)
        {
            throw new ArgumentException("Clinic ID cannot be empty GUID.", nameof(clinicId));
        }

        ClinicId = clinicId;
        SetNames(firstName, lastName);
        DateOfBirth = dateOfBirth;
        Gender = gender?.Trim();
        Phone = phone?.Trim();
        SetEmail(email);
        ExternalMedicalRecordNumber = externalMrn?.Trim();
        MedicalAlerts = medicalAlerts?.Trim();
        IsActive = true;
        ConcurrencyVersion = 1;
    }

    public static Patient Create(
        Guid clinicId,
        string firstName,
        string lastName,
        DateOnly? dateOfBirth,
        string? gender,
        string? phone,
        string? email,
        string? externalMrn,
        string? medicalAlerts,
        DateTime utcNow)
    {
        return new Patient(
            Guid.NewGuid(),
            clinicId,
            firstName,
            lastName,
            dateOfBirth,
            gender,
            phone,
            email,
            externalMrn,
            medicalAlerts,
            utcNow);
    }

    public static Patient CreateWithId(
        Guid id,
        Guid clinicId,
        string firstName,
        string lastName,
        DateOnly? dateOfBirth,
        string? gender,
        string? phone,
        string? email,
        string? externalMrn,
        string? medicalAlerts,
        DateTime utcNow)
    {
        return new Patient(
            id,
            clinicId,
            firstName,
            lastName,
            dateOfBirth,
            gender,
            phone,
            email,
            externalMrn,
            medicalAlerts,
            utcNow);
    }

    /// <summary>
    /// Update demographics and contacts under optimistic concurrency control:
    /// the caller must supply the version it based the edit on.
    /// </summary>
    public void UpdateDemographics(
        string firstName,
        string lastName,
        DateOnly? dateOfBirth,
        string? gender,
        string? phone,
        string? email,
        string? externalMrn,
        int expectedVersion,
        DateTime utcNow)
    {
        EnsureVersionMatches(expectedVersion);
        SetNames(firstName, lastName);
        DateOfBirth = dateOfBirth;
        Gender = gender?.Trim();
        Phone = phone?.Trim();
        SetEmail(email);
        ExternalMedicalRecordNumber = externalMrn?.Trim();
        ConcurrencyVersion++;
        SetUpdatedTimestamp(utcNow);
    }

    public void UpdateMedicalAlerts(string? alerts, DateTime utcNow)
    {
        MedicalAlerts = alerts?.Trim();
        SetUpdatedTimestamp(utcNow);
    }

    /// <summary>Archive the patient (soft state; clinical history is preserved).</summary>
    public void Archive(DateTime utcNow)
    {
        IsActive = false;
        SetUpdatedTimestamp(utcNow);
    }

    public void Restore(DateTime utcNow)
    {
        IsActive = true;
        SetUpdatedTimestamp(utcNow);
    }

    private void EnsureVersionMatches(int expectedVersion)
    {
        if (expectedVersion != ConcurrencyVersion)
        {
            throw new ConcurrencyConflictException(Id, expectedVersion, ConcurrencyVersion);
        }
    }

    private void SetNames(string firstName, string lastName)
    {
        if (string.IsNullOrWhiteSpace(firstName))
        {
            throw new ArgumentException("First name cannot be null or whitespace.", nameof(firstName));
        }

        if (string.IsNullOrWhiteSpace(lastName))
        {
            throw new ArgumentException("Last name cannot be null or whitespace.", nameof(lastName));
        }

        FirstName = firstName.Trim();
        LastName = lastName.Trim();
    }

    private void SetEmail(string? email)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            Email = null;
            return;
        }

        var normalized = email.Trim().ToLowerInvariant();
        if (!normalized.Contains('@') || normalized.StartsWith('@') || normalized.EndsWith('@'))
        {
            throw new ArgumentException("Email must be a valid email address.", nameof(email));
        }

        Email = normalized;
    }
}
