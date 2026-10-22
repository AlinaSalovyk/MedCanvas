using FluentAssertions;
using MedCanvas.Domain.Entities;
using MedCanvas.Domain.Enums;
using Xunit;

namespace MedCanvas.Domain.Tests;

public class ClinicMembershipTests
{
    private readonly DateTime _now = new(2026, 10, 22, 12, 0, 0, DateTimeKind.Utc);
    private readonly Guid _clinicId = Guid.NewGuid();
    private readonly Guid _userId = Guid.NewGuid();

    [Fact]
    public void Create_WithValidParameters_SetsPropertiesCorrectly()
    {
        var membership = ClinicMembership.Create(_clinicId, _userId, MembershipRole.Clinician, _now);

        membership.Id.Should().NotBeEmpty();
        membership.ClinicId.Should().Be(_clinicId);
        membership.UserId.Should().Be(_userId);
        membership.Role.Should().Be(MembershipRole.Clinician);
        membership.IsActive.Should().BeTrue();
        membership.CreatedAtUtc.Should().Be(_now);
    }

    [Fact]
    public void Create_WithEmptyClinicId_ThrowsArgumentException()
    {
        var act = () => ClinicMembership.Create(Guid.Empty, _userId, MembershipRole.Clinician, _now);
        act.Should().Throw<ArgumentException>().WithParameterName("clinicId");
    }

    [Fact]
    public void Create_WithEmptyUserId_ThrowsArgumentException()
    {
        var act = () => ClinicMembership.Create(_clinicId, Guid.Empty, MembershipRole.Clinician, _now);
        act.Should().Throw<ArgumentException>().WithParameterName("userId");
    }

    [Fact]
    public void ChangeRole_UpdatesRoleAndTimestamp()
    {
        var membership = ClinicMembership.Create(_clinicId, _userId, MembershipRole.Assistant, _now);
        var updateTime = _now.AddDays(5);

        membership.ChangeRole(MembershipRole.Clinician, updateTime);

        membership.Role.Should().Be(MembershipRole.Clinician);
        membership.UpdatedAtUtc.Should().Be(updateTime);
    }

    [Fact]
    public void DeactivateAndActivate_TogglesIsActive()
    {
        var membership = ClinicMembership.Create(_clinicId, _userId, MembershipRole.Clinician, _now);

        membership.Deactivate(_now.AddHours(1));
        membership.IsActive.Should().BeFalse();

        membership.Activate(_now.AddHours(2));
        membership.IsActive.Should().BeTrue();
    }
}
