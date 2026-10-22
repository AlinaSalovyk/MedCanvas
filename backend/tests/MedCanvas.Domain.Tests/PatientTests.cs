using FluentAssertions;
using MedCanvas.Domain.Entities;
using Xunit;

namespace MedCanvas.Domain.Tests;

public class PatientTests
{
    private readonly DateTime _now = new(2026, 10, 22, 12, 0, 0, DateTimeKind.Utc);
    private readonly Guid _clinicId = Guid.NewGuid();

    [Fact]
    public void Create_WithValidParameters_SetsPropertiesCorrectly()
    {
        var dob = new DateOnly(1985, 6, 15);
        var patient = Patient.Create(
            _clinicId,
            "John",
            "Doe",
            dob,
            "Male",
            "+380501112233",
            "john.doe@example.com",
            "MRN-1001",
            "Penicillin allergy",
            _now);

        patient.Id.Should().NotBeEmpty();
        patient.ClinicId.Should().Be(_clinicId);
        patient.FirstName.Should().Be("John");
        patient.LastName.Should().Be("Doe");
        patient.FullName.Should().Be("John Doe");
        patient.DateOfBirth.Should().Be(dob);
        patient.Gender.Should().Be("Male");
        patient.Phone.Should().Be("+380501112233");
        patient.Email.Should().Be("john.doe@example.com");
        patient.ExternalMedicalRecordNumber.Should().Be("MRN-1001");
        patient.MedicalAlerts.Should().Be("Penicillin allergy");
        patient.IsActive.Should().BeTrue();
    }

    [Fact]
    public void Create_WithEmptyClinicId_ThrowsArgumentException()
    {
        var act = () => Patient.Create(
            Guid.Empty,
            "John",
            "Doe",
            null,
            null,
            null,
            null,
            null,
            null,
            _now);

        act.Should().Throw<ArgumentException>().WithParameterName("clinicId");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Create_WithInvalidFirstName_ThrowsArgumentException(string? invalidFirst)
    {
        var act = () => Patient.Create(
            _clinicId,
            invalidFirst!,
            "Doe",
            null,
            null,
            null,
            null,
            null,
            null,
            _now);

        act.Should().Throw<ArgumentException>().WithParameterName("firstName");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Create_WithInvalidLastName_ThrowsArgumentException(string? invalidLast)
    {
        var act = () => Patient.Create(
            _clinicId,
            "John",
            invalidLast!,
            null,
            null,
            null,
            null,
            null,
            null,
            _now);

        act.Should().Throw<ArgumentException>().WithParameterName("lastName");
    }

    [Fact]
    public void Create_WithInvalidEmail_ThrowsArgumentException()
    {
        var act = () => Patient.Create(
            _clinicId,
            "John",
            "Doe",
            null,
            null,
            null,
            "invalid-email",
            null,
            null,
            _now);

        act.Should().Throw<ArgumentException>().WithParameterName("email");
    }

    [Fact]
    public void UpdateDemographics_UpdatesPropertiesAndTimestamp()
    {
        var patient = Patient.Create(
            _clinicId,
            "OldFirst",
            "OldLast",
            null,
            null,
            null,
            null,
            null,
            null,
            _now);

        var updateTime = _now.AddDays(1);
        patient.UpdateDemographics(
            "NewFirst",
            "NewLast",
            new DateOnly(1990, 1, 1),
            "Female",
            "+1234567890",
            "new@example.com",
            "MRN-2002",
            updateTime);

        patient.FirstName.Should().Be("NewFirst");
        patient.LastName.Should().Be("NewLast");
        patient.FullName.Should().Be("NewFirst NewLast");
        patient.Gender.Should().Be("Female");
        patient.ExternalMedicalRecordNumber.Should().Be("MRN-2002");
        patient.UpdatedAtUtc.Should().Be(updateTime);
    }

    [Fact]
    public void UpdateMedicalAlerts_UpdatesAlerts()
    {
        var patient = Patient.Create(
            _clinicId,
            "John",
            "Doe",
            null,
            null,
            null,
            null,
            null,
            null,
            _now);

        var updateTime = _now.AddHours(2);
        patient.UpdateMedicalAlerts("Latex allergy", updateTime);

        patient.MedicalAlerts.Should().Be("Latex allergy");
        patient.UpdatedAtUtc.Should().Be(updateTime);
    }

    [Fact]
    public void DeactivateAndActivate_TogglesIsActive()
    {
        var patient = Patient.Create(
            _clinicId,
            "John",
            "Doe",
            null,
            null,
            null,
            null,
            null,
            null,
            _now);

        patient.Deactivate(_now.AddHours(1));
        patient.IsActive.Should().BeFalse();

        patient.Activate(_now.AddHours(2));
        patient.IsActive.Should().BeTrue();
    }

    [Fact]
    public void CreateWithId_SetsPropertiesExplicitly()
    {
        var id = Guid.NewGuid();
        var patient = Patient.CreateWithId(
            id,
            _clinicId,
            "John",
            "Doe",
            new DateOnly(1980, 5, 20),
            "Male",
            "+12345",
            null,
            "MRN-999",
            null,
            _now);

        patient.Id.Should().Be(id);
        patient.ClinicId.Should().Be(_clinicId);
        patient.FirstName.Should().Be("John");
        patient.Email.Should().BeNull();
    }
}

