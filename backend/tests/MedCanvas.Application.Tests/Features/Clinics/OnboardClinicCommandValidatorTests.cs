using FluentValidation.TestHelper;
using MedCanvas.Application.Features.Clinics;
using Xunit;

namespace MedCanvas.Application.Tests.Features.Clinics;

public class OnboardClinicCommandValidatorTests
{
    private readonly OnboardClinicCommandValidator _validator = new();

    private static OnboardClinicCommand Valid() => new(
        "Smile Dental Clinic",
        "SMILE-01",
        "admin@smiledental.com",
        "Admin Person",
        "StrongP@ssw0rd123!",
        "Europe/Kyiv");

    [Fact]
    public void ValidCommand_Passes()
    {
        var result = _validator.TestValidate(Valid());
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void ClinicName_MissingOrWhitespace_Fails(string? name)
    {
        var result = _validator.TestValidate(Valid() with { ClinicName = name! });
        result.ShouldHaveValidationErrorFor(x => x.ClinicName);
    }

    [Fact]
    public void ClinicName_Over200Chars_Fails()
    {
        var result = _validator.TestValidate(Valid() with { ClinicName = new string('n', 201) });
        result.ShouldHaveValidationErrorFor(x => x.ClinicName);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("A")]
    [InlineData(" leading-dash")]
    [InlineData("has space")]
    [InlineData("under_score")]
    public void ClinicIdentifier_Invalid_Fails(string? identifier)
    {
        var result = _validator.TestValidate(Valid() with { ClinicIdentifier = identifier! });
        result.ShouldHaveValidationErrorFor(x => x.ClinicIdentifier);
    }

    [Fact]
    public void ClinicIdentifier_Over50Chars_Fails()
    {
        var result = _validator.TestValidate(Valid() with { ClinicIdentifier = new string('A', 51) });
        result.ShouldHaveValidationErrorFor(x => x.ClinicIdentifier);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("no-at-sign")]
    public void AdminEmail_Invalid_Fails(string? email)
    {
        var result = _validator.TestValidate(Valid() with { AdminEmail = email! });
        result.ShouldHaveValidationErrorFor(x => x.AdminEmail);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("short1A")]
    [InlineData("12345678!")]
    public void AdminPassword_Invalid_Fails(string? password)
    {
        var result = _validator.TestValidate(Valid() with { AdminPassword = password! });
        result.ShouldHaveValidationErrorFor(x => x.AdminPassword);
    }

    [Fact]
    public void AdminPassword_Over100Chars_Fails()
    {
        var result = _validator.TestValidate(Valid() with { AdminPassword = new string('p', 101) + "1A" });
        result.ShouldHaveValidationErrorFor(x => x.AdminPassword);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("Not/AZone")]
    [InlineData("Mars/Olympus")]
    public void TimeZoneId_Invalid_Fails(string? timeZoneId)
    {
        var result = _validator.TestValidate(Valid() with { TimeZoneId = timeZoneId! });
        result.ShouldHaveValidationErrorFor(x => x.TimeZoneId);
    }

    [Theory]
    [InlineData("Europe/Kyiv")]
    [InlineData("Europe/London")]
    [InlineData("UTC")]
    public void TimeZoneId_KnownZones_Pass(string timeZoneId)
    {
        var result = _validator.TestValidate(Valid() with { TimeZoneId = timeZoneId });
        result.ShouldNotHaveValidationErrorFor(x => x.TimeZoneId);
    }
}
