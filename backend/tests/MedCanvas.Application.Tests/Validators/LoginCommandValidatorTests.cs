using FluentAssertions;
using FluentValidation.TestHelper;
using MedCanvas.Application.Features.Auth;
using Xunit;

namespace MedCanvas.Application.Tests.Validators;

public class LoginCommandValidatorTests
{
    private readonly LoginCommandValidator _validator = new();

    [Fact]
    public void Validate_WhenCommandIsValid_ShouldNotHaveAnyErrors()
    {
        var command = new LoginCommand("clinician@medcanvas.com", "SecurePassword123!", Guid.NewGuid());

        var result = _validator.TestValidate(command);

        result.ShouldNotHaveAnyValidationErrors();
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData(null)]
    public void Validate_WhenEmailIsEmpty_ShouldHaveValidationError(string? invalidEmail)
    {
        var command = new LoginCommand(invalidEmail!, "SecurePassword123!", Guid.NewGuid());

        var result = _validator.TestValidate(command);

        result.ShouldHaveValidationErrorFor(x => x.Email)
            .WithErrorMessage("Email address is required.");
    }

    [Fact]
    public void Validate_WhenEmailIsInvalidFormat_ShouldHaveValidationError()
    {
        var command = new LoginCommand("invalid-email-format", "SecurePassword123!", Guid.NewGuid());

        var result = _validator.TestValidate(command);

        result.ShouldHaveValidationErrorFor(x => x.Email)
            .WithErrorMessage("A valid email address must be provided.");
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData(null)]
    public void Validate_WhenPasswordIsEmpty_ShouldHaveValidationError(string? invalidPassword)
    {
        var command = new LoginCommand("clinician@medcanvas.com", invalidPassword!, Guid.NewGuid());

        var result = _validator.TestValidate(command);

        result.ShouldHaveValidationErrorFor(x => x.Password)
            .WithErrorMessage("Password is required.");
    }

    [Fact]
    public void Validate_WhenClinicIdIsEmpty_ShouldHaveValidationError()
    {
        var command = new LoginCommand("clinician@medcanvas.com", "SecurePassword123!", Guid.Empty);

        var result = _validator.TestValidate(command);

        result.ShouldHaveValidationErrorFor(x => x.ClinicId)
            .WithErrorMessage("Clinic identifier must not be empty when provided.");
    }
}
