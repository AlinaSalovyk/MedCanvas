using MedCanvas.Domain.Common;

namespace MedCanvas.Domain.Entities;

/// <summary>A dental chair / operatory resource of a clinic.</summary>
public sealed class ClinicChair : BaseEntity, IAggregateRoot
{
    public Guid ClinicId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public bool IsActive { get; private set; }

    private ClinicChair()
    {
    }

    private ClinicChair(Guid id, Guid clinicId, string name, DateTime createdAtUtc)
        : base(id, createdAtUtc)
    {
        if (clinicId == Guid.Empty)
        {
            throw new ArgumentException("Clinic ID cannot be empty GUID.", nameof(clinicId));
        }

        ClinicId = clinicId;
        SetName(name);
        IsActive = true;
    }

    public static ClinicChair Create(Guid clinicId, string name, DateTime utcNow) =>
        new(Guid.NewGuid(), clinicId, name, utcNow);

    public static ClinicChair CreateWithId(Guid id, Guid clinicId, string name, DateTime utcNow) =>
        new(id, clinicId, name, utcNow);

    public void Rename(string name, DateTime utcNow)
    {
        SetName(name);
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
            throw new ArgumentException("Chair name cannot be null or whitespace.", nameof(name));
        }

        Name = name.Trim();
    }
}
