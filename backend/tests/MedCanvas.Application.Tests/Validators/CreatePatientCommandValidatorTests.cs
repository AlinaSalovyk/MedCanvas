using FluentAssertions;
using FluentValidation.TestHelper;
using MedCanvas.Application.Features.Patients;
using Xunit;

namespace MedCanvas.Application.Tests.Validators;

public class CreatePatientCommandValidatorTests
{
    private readonly CreatePatientCommandValidator _validator = new();

    [Fact]
    public void Validate_WhenCommandIsValid_ShouldNotHaveAnyErrors()
    {
        var command = new CreatePatientCommand(
            FirstName: "Taras",
            LastName: "Shevchenko",
            BirthDate: new DateOnly(1814, 3, 9),
            Gender: "Male",
            Phone: "+380501234567",
            Email: "taras@example.com",
            ExternalMedicalRecordNumber: "MRN-1814",
            Notes: "Sample notes");

        var result = _validator.TestValidate(command);

        result.ShouldNotHaveAnyValidationErrors();
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData(null)]
    public void Validate_WhenFirstNameIsEmpty_ShouldHaveValidationError(string? invalidName)
    {
        var command = new CreatePatientCommand(
            FirstName: invalidName!,
            LastName: "Shevchenko",
            BirthDate: null,
            Gender: null,
            Phone: null,
            Email: null,
            ExternalMedicalRecordNumber: null,
            Notes: null);

        var result = _validator.TestValidate(command);

        result.ShouldHaveValidationErrorFor(x => x.FirstName)
            .WithErrorMessage("First name is required.");
    }

    [Fact]
    public void Validate_WhenFirstNameExceeds100Characters_ShouldHaveValidationError()
    {
        var command = new CreatePatientCommand(
            FirstName: new string('a', 101),
            LastName: "Shevchenko",
            BirthDate: null,
            Gender: null,
            Phone: null,
            Email: null,
            ExternalMedicalRecordNumber: null,
            Notes: null);

        var result = _validator.TestValidate(command);

        result.ShouldHaveValidationErrorFor(x => x.FirstName)
            .WithErrorMessage("First name cannot exceed 100 characters.");
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData(null)]
    public void Validate_WhenLastNameIsEmpty_ShouldHaveValidationError(string? invalidName)
    {
        var command = new CreatePatientCommand(
            FirstName: "Taras",
            LastName: invalidName!,
            BirthDate: null,
            Gender: null,
            Phone: null,
            Email: null,
            ExternalMedicalRecordNumber: null,
            Notes: null);

        var result = _validator.TestValidate(command);

        result.ShouldHaveValidationErrorFor(x => x.LastName)
            .WithErrorMessage("Last name is required.");
    }

    [Fact]
    public void Validate_WhenEmailIsInvalidFormat_ShouldHaveValidationError()
    {
        var command = new CreatePatientCommand(
            FirstName: "Taras",
            LastName: "Shevchenko",
            BirthDate: null,
            Gender: null,
            Phone: null,
            Email: "not-an-email",
            ExternalMedicalRecordNumber: null,
            Notes: null);

        var result = _validator.TestValidate(command);

        result.ShouldHaveValidationErrorFor(x => x.Email)
            .WithErrorMessage("A valid email address must be provided.");
    }
}
