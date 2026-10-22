using MedCanvas.Domain.Common;
using MedCanvas.Domain.Enums;

namespace MedCanvas.Domain.Entities;

/// <summary>
/// Entity mapping a User to a Clinic with a specific MembershipRole.
/// </summary>
public sealed class ClinicMembership : BaseEntity
{
    public Guid ClinicId { get; private set; }
    public Guid UserId { get; private set; }
    public MembershipRole Role { get; private set; }
    public bool IsActive { get; private set; }

    private ClinicMembership()
    {
    }

    private ClinicMembership(Guid id, Guid clinicId, Guid userId, MembershipRole role, DateTime createdAtUtc)
        : base(id, createdAtUtc)
    {
        if (clinicId == Guid.Empty)
        {
            throw new ArgumentException("Clinic ID cannot be empty GUID.", nameof(clinicId));
        }

        if (userId == Guid.Empty)
        {
            throw new ArgumentException("User ID cannot be empty GUID.", nameof(userId));
        }

        ClinicId = clinicId;
        UserId = userId;
        Role = role;
        IsActive = true;
    }

    public static ClinicMembership Create(Guid clinicId, Guid userId, MembershipRole role, DateTime utcNow)
    {
        return new ClinicMembership(Guid.NewGuid(), clinicId, userId, role, utcNow);
    }

    public static ClinicMembership CreateWithId(Guid id, Guid clinicId, Guid userId, MembershipRole role, DateTime utcNow)
    {
        return new ClinicMembership(id, clinicId, userId, role, utcNow);
    }

    public void ChangeRole(MembershipRole newRole, DateTime utcNow)
    {
        Role = newRole;
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
}
