using FluentAssertions;
using FluentValidation.TestHelper;
using MedCanvas.Application.Features.Odontograms;
using Xunit;

namespace MedCanvas.Application.Tests.Validators;

public class SaveOdontogramCommandValidatorTests
{
    private readonly SaveOdontogramCommandValidator _validator = new();

    [Fact]
    public void Validate_WhenCommandIsValid_ShouldNotHaveAnyErrors()
    {
        var command = new SaveOdontogramCommand(
            EncounterId: Guid.NewGuid(),
            SnapshotJson: """{"version":"2.22","teeth":{}}""",
            ChangeSummary: "Updated caries findings",
            IfMatchETag: null);

        var result = _validator.TestValidate(command);

        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_WhenEncounterIdIsEmpty_ShouldHaveValidationError()
    {
        var command = new SaveOdontogramCommand(
            EncounterId: Guid.Empty,
            SnapshotJson: """{"version":"2.22","teeth":{}}""",
            ChangeSummary: null,
            IfMatchETag: null);

        var result = _validator.TestValidate(command);

        result.ShouldHaveValidationErrorFor(x => x.EncounterId)
            .WithErrorMessage("Encounter identifier is required.");
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData(null)]
    public void Validate_WhenSnapshotJsonIsEmpty_ShouldHaveValidationError(string? invalidJson)
    {
        var command = new SaveOdontogramCommand(
            EncounterId: Guid.NewGuid(),
            SnapshotJson: invalidJson!,
            ChangeSummary: null,
            IfMatchETag: null);

        var result = _validator.TestValidate(command);

        result.ShouldHaveValidationErrorFor(x => x.SnapshotJson);
    }

    [Fact]
    public void Validate_WhenSnapshotJsonIsNotJson_ShouldHaveValidationError()
    {
        var command = new SaveOdontogramCommand(
            EncounterId: Guid.NewGuid(),
            SnapshotJson: "not a json string",
            ChangeSummary: null,
            IfMatchETag: null);

        var result = _validator.TestValidate(command);

        result.ShouldHaveValidationErrorFor(x => x.SnapshotJson)
            .WithErrorMessage("Snapshot must be a valid serialized JSON document.");
    }

    [Theory]
    [InlineData("""{"version":"2.22"}""")]
    [InlineData("""{"teeth":{}}""")]
    [InlineData("""{}""")]
    public void Validate_WhenSnapshotJsonMissingRequiredRootProperties_ShouldHaveValidationError(string incompleteJson)
    {
        var command = new SaveOdontogramCommand(
            EncounterId: Guid.NewGuid(),
            SnapshotJson: incompleteJson,
            ChangeSummary: null,
            IfMatchETag: null);

        var result = _validator.TestValidate(command);

        result.ShouldHaveValidationErrorFor(x => x.SnapshotJson)
            .WithErrorMessage("Snapshot payload must contain 'version' and 'teeth' root properties.");
    }

    [Fact]
    public void Validate_WhenChangeSummaryExceeds500Characters_ShouldHaveValidationError()
    {
        var command = new SaveOdontogramCommand(
            EncounterId: Guid.NewGuid(),
            SnapshotJson: """{"version":"2.22","teeth":{}}""",
            ChangeSummary: new string('a', 501),
            IfMatchETag: null);

        var result = _validator.TestValidate(command);

        result.ShouldHaveValidationErrorFor(x => x.ChangeSummary)
            .WithErrorMessage("Change summary cannot exceed 500 characters.");
    }
}
