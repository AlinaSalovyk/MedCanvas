using FluentAssertions;
using FluentValidation.TestHelper;
using MedCanvas.Application.Features.Clinics;
using Xunit;

namespace MedCanvas.Application.Tests.Features.Clinics;

public class AddClinicMemberCommandValidatorTests
{
    private readonly AddClinicMemberCommandValidator _validator = new();

    private static AddClinicMemberCommand Valid() => new(
        "assistant@smiledental.com",
        "Assistant Person",
        "StrongP@ssw0rd123!",
        "Assistant");

    [Fact]
    public void ValidCommand_Passes()
    {
        var result = _validator.TestValidate(Valid());
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Theory]
    [InlineData("not-a-role")]
    [InlineData("clinician")]
    [InlineData("CLINICADMIN")]
    [InlineData("")]
    public void Role_MustBeExactMembershipRoleEnum_Fails(string role)
    {
        var result = _validator.TestValidate(Valid() with { Role = role });
        result.ShouldHaveValidationErrorFor(x => x.Role);
    }

    [Theory]
    [InlineData("ClinicAdmin")]
    [InlineData("Clinician")]
    [InlineData("Assistant")]
    [InlineData("Viewer")]
    public void Role_KnownRoles_Pass(string role)
    {
        var result = _validator.TestValidate(Valid() with { Role = role });
        result.ShouldNotHaveValidationErrorFor(x => x.Role);
    }

    [Theory]
    [InlineData(null, "Name", "StrongP@ssw0rd123!", "Assistant")]
    [InlineData("a@b.c", "", "StrongP@ssw0rd123!", "Assistant")]
    [InlineData("a@b.c", "Name", "short1A", "Assistant")]
    [InlineData("a@b.c", "Name", "StrongP@ssw0rd123!", "")]
    public void MissingRequiredFields_Fail(string? email, string fullName, string password, string role)
    {
        var result = _validator.TestValidate(new AddClinicMemberCommand(email!, fullName, password, role));
        result.Errors.Should().NotBeEmpty();
    }

    [Fact]
    public void FullName_Over200Chars_Fails()
    {
        var result = _validator.TestValidate(Valid() with { FullName = new string('n', 201) });
        result.ShouldHaveValidationErrorFor(x => x.FullName);
    }
}

public class ChangeMemberRoleCommandValidatorTests
{
    private readonly ChangeMemberRoleCommandValidator _validator = new();

    [Fact]
    public void ValidCommand_Passes()
    {
        var result = _validator.TestValidate(new ChangeMemberRoleCommand(Guid.NewGuid(), "Clinician"));
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void EmptyUserId_Fails()
    {
        var result = _validator.TestValidate(new ChangeMemberRoleCommand(Guid.Empty, "Clinician"));
        result.ShouldHaveValidationErrorFor(x => x.UserId);
    }

    [Theory]
    [InlineData("")]
    [InlineData("boss")]
    [InlineData("admin")]
    public void InvalidRole_Fails(string role)
    {
        var result = _validator.TestValidate(new ChangeMemberRoleCommand(Guid.NewGuid(), role));
        result.ShouldHaveValidationErrorFor(x => x.Role);
    }
}

public class RevokeAndActivateClinicMemberValidatorsTests
{
    [Fact]
    public void Revoke_EmptyUserId_Fails()
    {
        var result = new RevokeClinicMemberCommandValidator().TestValidate(new RevokeClinicMemberCommand(Guid.Empty));
        result.ShouldHaveValidationErrorFor(x => x.UserId);
    }

    [Fact]
    public void Activate_EmptyUserId_Fails()
    {
        var result = new ActivateClinicMemberCommandValidator().TestValidate(new ActivateClinicMemberCommand(Guid.Empty));
        result.ShouldHaveValidationErrorFor(x => x.UserId);
    }

    [Fact]
    public void Revoke_ValidUserId_Passes()
    {
        var result = new RevokeClinicMemberCommandValidator().TestValidate(new RevokeClinicMemberCommand(Guid.NewGuid()));
        result.ShouldNotHaveAnyValidationErrors();
    }
}

public class UpdateClinicSettingsCommandValidatorTests
{
    private readonly UpdateClinicSettingsCommandValidator _validator = new();

    [Fact]
    public void ValidCommand_Passes()
    {
        var result = _validator.TestValidate(new UpdateClinicSettingsCommand("Smile Clinic", "Europe/Kyiv"));
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Theory]
    [InlineData(null, "Europe/Kyiv")]
    [InlineData("", "Europe/Kyiv")]
    [InlineData("Name", "")]
    [InlineData("Name", "Not/AZone")]
    public void InvalidNameOrTimeZone_Fails(string? name, string? timeZoneId)
    {
        var result = _validator.TestValidate(new UpdateClinicSettingsCommand(name!, timeZoneId!));
        result.Errors.Should().NotBeEmpty();
    }

    [Fact]
    public void Name_Over200Chars_Fails()
    {
        var result = _validator.TestValidate(new UpdateClinicSettingsCommand(new string('n', 201), "Europe/Kyiv"));
        result.ShouldHaveValidationErrorFor(x => x.Name);
    }
}
