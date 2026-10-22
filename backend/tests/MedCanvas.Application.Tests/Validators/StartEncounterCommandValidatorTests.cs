using FluentAssertions;
using FluentValidation.TestHelper;
using MedCanvas.Application.Features.Encounters;
using Xunit;

namespace MedCanvas.Application.Tests.Validators;

public class StartEncounterCommandValidatorTests
{
    private readonly StartEncounterCommandValidator _validator = new();

    [Fact]
    public void Validate_WhenCommandIsValid_ShouldNotHaveAnyErrors()
    {
        var command = new StartEncounterCommand(Guid.NewGuid(), "Routine checkup and scaling");

        var result = _validator.TestValidate(command);

        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_WhenPatientIdIsEmpty_ShouldHaveValidationError()
    {
        var command = new StartEncounterCommand(Guid.Empty, "Chief complaint");

        var result = _validator.TestValidate(command);

        result.ShouldHaveValidationErrorFor(x => x.PatientId)
            .WithErrorMessage("Patient identifier is required.");
    }

    [Fact]
    public void Validate_WhenChiefComplaintExceeds1000Characters_ShouldHaveValidationError()
    {
        var command = new StartEncounterCommand(Guid.NewGuid(), new string('x', 1001));

        var result = _validator.TestValidate(command);

        result.ShouldHaveValidationErrorFor(x => x.ChiefComplaint)
            .WithErrorMessage("Chief complaint cannot exceed 1000 characters.");
    }
}
