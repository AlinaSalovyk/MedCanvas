using FluentAssertions;
using MedCanvas.Domain.Entities;
using Xunit;

namespace MedCanvas.Domain.Tests;

public class UserTests
{
    private readonly DateTime _now = new(2026, 10, 22, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void Create_WithValidParameters_SetsPropertiesAndNormalizesEmail()
    {
        var user = User.Create("  Dr.Dentist@Clinic.COM  ", "Dr. Sarah Smith", "hash123", _now);

        user.Id.Should().NotBeEmpty();
        user.Email.Should().Be("dr.dentist@clinic.com");
        user.FullName.Should().Be("Dr. Sarah Smith");
        user.PasswordHash.Should().Be("hash123");
        user.IsActive.Should().BeTrue();
        user.CreatedAtUtc.Should().Be(_now);
        user.UpdatedAtUtc.Should().Be(_now);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("invalid-email")]
    [InlineData("@nodomain.com")]
    [InlineData("nouser@")]
    public void Create_WithInvalidEmail_ThrowsArgumentException(string? invalidEmail)
    {
        var act = () => User.Create(invalidEmail!, "Dr. Smith", "hash123", _now);
        act.Should().Throw<ArgumentException>().WithParameterName("email");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Create_WithInvalidFullName_ThrowsArgumentException(string? invalidFullName)
    {
        var act = () => User.Create("dr.smith@example.com", invalidFullName!, "hash123", _now);
        act.Should().Throw<ArgumentException>().WithParameterName("fullName");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Create_WithInvalidPasswordHash_ThrowsArgumentException(string? invalidHash)
    {
        var act = () => User.Create("dr.smith@example.com", "Dr. Smith", invalidHash!, _now);
        act.Should().Throw<ArgumentException>().WithParameterName("passwordHash");
    }

    [Fact]
    public void UpdateProfile_UpdatesFullNameAndTimestamp()
    {
        var user = User.Create("user@example.com", "Old Name", "hash", _now);
        var updateTime = _now.AddHours(1);

        user.UpdateProfile("New Name", updateTime);

        user.FullName.Should().Be("New Name");
        user.UpdatedAtUtc.Should().Be(updateTime);
    }

    [Fact]
    public void ChangePassword_UpdatesPasswordHashAndTimestamp()
    {
        var user = User.Create("user@example.com", "Name", "oldHash", _now);
        var updateTime = _now.AddHours(1);

        user.ChangePassword("newHash", updateTime);

        user.PasswordHash.Should().Be("newHash");
        user.UpdatedAtUtc.Should().Be(updateTime);
    }

    [Fact]
    public void DeactivateAndActivate_TogglesIsActive()
    {
        var user = User.Create("user@example.com", "Name", "hash", _now);

        user.Deactivate(_now.AddMinutes(10));
        user.IsActive.Should().BeFalse();

        user.Activate(_now.AddMinutes(20));
        user.IsActive.Should().BeTrue();
    }
}
