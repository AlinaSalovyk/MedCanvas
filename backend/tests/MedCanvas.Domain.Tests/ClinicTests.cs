using FluentAssertions;
using MedCanvas.Domain.Entities;
using Xunit;

namespace MedCanvas.Domain.Tests;

public class ClinicTests
{
    private readonly DateTime _now = new(2026, 10, 22, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void Create_WithValidParameters_SetsPropertiesCorrectly()
    {
        var clinic = Clinic.Create("Metropolitan Dental Clinic", "METRO-01", _now);

        clinic.Id.Should().NotBeEmpty();
        clinic.Name.Should().Be("Metropolitan Dental Clinic");
        clinic.Identifier.Should().Be("METRO-01");
        clinic.IsActive.Should().BeTrue();
        clinic.CreatedAtUtc.Should().Be(_now);
        clinic.UpdatedAtUtc.Should().Be(_now);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Create_WithInvalidName_ThrowsArgumentException(string? invalidName)
    {
        var act = () => Clinic.Create(invalidName!, "CLINIC-01", _now);
        act.Should().Throw<ArgumentException>().WithParameterName("name");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Create_WithInvalidIdentifier_ThrowsArgumentException(string? invalidIdentifier)
    {
        var act = () => Clinic.Create("Valid Name", invalidIdentifier!, _now);
        act.Should().Throw<ArgumentException>().WithParameterName("identifier");
    }

    [Fact]
    public void Update_WithValidParameters_UpdatesPropertiesAndTimestamp()
    {
        var clinic = Clinic.Create("Old Name", "OLD-01", _now);
        var updateTime = _now.AddHours(2);

        clinic.Update("New Name", "NEW-01", updateTime);

        clinic.Name.Should().Be("New Name");
        clinic.Identifier.Should().Be("NEW-01");
        clinic.UpdatedAtUtc.Should().Be(updateTime);
    }

    [Fact]
    public void Deactivate_SetsIsActiveToFalse()
    {
        var clinic = Clinic.Create("Clinic", "C-01", _now);
        var deactTime = _now.AddMinutes(30);

        clinic.Deactivate(deactTime);

        clinic.IsActive.Should().BeFalse();
        clinic.UpdatedAtUtc.Should().Be(deactTime);
    }

    [Fact]
    public void Activate_SetsIsActiveToTrue()
    {
        var clinic = Clinic.Create("Clinic", "C-01", _now);
        clinic.Deactivate(_now.AddMinutes(10));

        var actTime = _now.AddMinutes(20);
        clinic.Activate(actTime);

        clinic.IsActive.Should().BeTrue();
        clinic.UpdatedAtUtc.Should().Be(actTime);
    }

    [Fact]
    public void CreateWithId_SetsExplicitId()
    {
        var id = Guid.NewGuid();
        var clinic = Clinic.CreateWithId(id, "Clinic", "C-01", _now);

        clinic.Id.Should().Be(id);
    }

    [Fact]
    public void Create_WithoutExplicitTimeZone_DefaultsToEuropeKyiv()
    {
        var clinic = Clinic.Create("Clinic", "C-01", _now);

        clinic.TimeZoneId.Should().Be("Europe/Kyiv");
    }

    [Theory]
    [InlineData("Europe/Kyiv")]
    [InlineData("Europe/London")]
    [InlineData("America/New_York")]
    [InlineData("UTC")]
    public void Create_WithKnownTimeZone_SetsTimeZoneId(string timeZoneId)
    {
        var clinic = Clinic.Create("Clinic", "C-01", _now, timeZoneId);

        clinic.TimeZoneId.Should().Be(timeZoneId);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("Mars/Olympus")]
    [InlineData("not/a/timezone!")]
    public void Create_WithUnknownTimeZone_ThrowsArgumentException(string? invalidTimeZone)
    {
        var act = () => Clinic.Create("Clinic", "C-01", _now, invalidTimeZone!);
        act.Should().Throw<ArgumentException>().WithParameterName("timeZoneId");
    }

    [Fact]
    public void UpdateProfile_UpdatesNameAndTimeZoneButKeepsIdentifierImmutable()
    {
        var clinic = Clinic.Create("Old Name", "OLD-01", _now, "Europe/Kyiv");
        var updateTime = _now.AddHours(3);

        clinic.UpdateProfile("New Name", "Europe/Berlin", updateTime);

        clinic.Name.Should().Be("New Name");
        clinic.TimeZoneId.Should().Be("Europe/Berlin");
        clinic.Identifier.Should().Be("OLD-01");
        clinic.UpdatedAtUtc.Should().Be(updateTime);
    }

    [Fact]
    public void UpdateProfile_WithUnknownTimeZone_ThrowsArgumentException()
    {
        var clinic = Clinic.Create("Clinic", "C-01", _now);

        var act = () => clinic.UpdateProfile("Clinic", "Galaxy/Deep", _now);
        act.Should().Throw<ArgumentException>().WithParameterName("timeZoneId");
    }
}
