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
            ExpectedVersion: null,
            ChangeSummary: "Updated caries findings");

        var result = _validator.TestValidate(command);

        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_WhenEncounterIdIsEmpty_ShouldHaveValidationError()
    {
        var command = new SaveOdontogramCommand(
            EncounterId: Guid.Empty,
            SnapshotJson: """{"version":"2.22","teeth":{}}""",
            ExpectedVersion: null,
            ChangeSummary: null);

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
            ExpectedVersion: null,
            ChangeSummary: null);

        var result = _validator.TestValidate(command);

        result.ShouldHaveValidationErrorFor(x => x.SnapshotJson);
    }

    [Fact]
    public void Validate_WhenSnapshotJsonIsNotJson_ShouldHaveValidationError()
    {
        var command = new SaveOdontogramCommand(
            EncounterId: Guid.NewGuid(),
            SnapshotJson: "not a json string",
            ExpectedVersion: null,
            ChangeSummary: null);

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
            ExpectedVersion: null,
            ChangeSummary: null);

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
            ExpectedVersion: null,
            ChangeSummary: new string('a', 501));

        var result = _validator.TestValidate(command);

        result.ShouldHaveValidationErrorFor(x => x.ChangeSummary)
            .WithErrorMessage("Change summary cannot exceed 500 characters.");
    }

    [Fact]
    public void Validate_WhenCariesIsMalformedObject_ShouldHaveValidationError()
    {
        // Malformed artificial shape from legacy tests: caries must be an array of surfaces
        var command = new SaveOdontogramCommand(
            EncounterId: Guid.NewGuid(),
            SnapshotJson: """{"version":"2.22","teeth":{"11":{"caries":{"distal":{"icdas":2}}}}}""",
            ExpectedVersion: null,
            ChangeSummary: null);

        var result = _validator.TestValidate(command);

        result.ShouldHaveValidationErrorFor(x => x.SnapshotJson)
            .WithErrorMessage("Tooth '11' caries finding in teeth must be an array of surface indicators.");
    }

    [Fact]
    public void Validate_WhenCariesIsValidArrayWithValidSeverity_ShouldNotHaveAnyErrors()
    {
        var command = new SaveOdontogramCommand(
            EncounterId: Guid.NewGuid(),
            SnapshotJson: """
            {
                "version": "2.22",
                "teeth": {
                    "11": {
                        "toothSelection": "tooth-base",
                        "caries": ["caries-distal", "caries-mesial"],
                        "cariesSeverity": { "distal": 2, "mesial": 3 }
                    }
                }
            }
            """,
            ExpectedVersion: null,
            ChangeSummary: null);

        var result = _validator.TestValidate(command);

        result.ShouldNotHaveAnyValidationErrors();
    }

    [Theory]
    [InlineData(7)]
    [InlineData(-1)]
    public void Validate_WhenCariesSeverityIsOutOfRange_ShouldHaveValidationError(int invalidGrade)
    {
        var json = $"{{\"version\":\"2.22\",\"teeth\":{{\"11\":{{\"cariesSeverity\":{{\"distal\":{invalidGrade}}}}}}}}}";
        var command = new SaveOdontogramCommand(
            EncounterId: Guid.NewGuid(),
            SnapshotJson: json,
            ExpectedVersion: null,
            ChangeSummary: null);

        var result = _validator.TestValidate(command);

        result.ShouldHaveValidationErrorFor(x => x.SnapshotJson)
            .WithErrorMessage("Tooth '11' caries severity on 'distal' in teeth must be an ICDAS/CARS integer between 0 and 6.");
    }

    [Theory]
    [InlineData("99")]
    [InlineData("0")]
    [InlineData("19")]
    [InlineData("abc")]
    public void Validate_WhenToothIdentifierIsNotValidFdi_ShouldHaveValidationError(string invalidToothId)
    {
        var json = $"{{\"version\":\"2.22\",\"teeth\":{{\"{invalidToothId}\":{{}}}}}}";
        var command = new SaveOdontogramCommand(
            EncounterId: Guid.NewGuid(),
            SnapshotJson: json,
            ExpectedVersion: null,
            ChangeSummary: null);

        var result = _validator.TestValidate(command);

        result.ShouldHaveValidationErrorFor(x => x.SnapshotJson)
            .WithErrorMessage($"Invalid tooth identifier '{invalidToothId}' in teeth. Valid 2-digit FDI notation is required.");
    }

    [Theory]
    [InlineData("51")]
    [InlineData("65")]
    [InlineData("73")]
    [InlineData("85")]
    public void Validate_WhenPrimaryToothIdentifierIsValidFdi_ShouldNotHaveAnyErrors(string primaryToothId)
    {
        var json = $"{{\"version\":\"2.22\",\"teeth\":{{\"{primaryToothId}\":{{\"toothSelection\":\"milktooth\"}}}}}}";
        var command = new SaveOdontogramCommand(
            EncounterId: Guid.NewGuid(),
            SnapshotJson: json,
            ExpectedVersion: null,
            ChangeSummary: null);

        var result = _validator.TestValidate(command);

        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_WhenPlanTeethContainsInvalidFdi_ShouldHaveValidationError()
    {
        var command = new SaveOdontogramCommand(
            EncounterId: Guid.NewGuid(),
            SnapshotJson: """{"version":"2.22","teeth":{},"plan":{"99":{}}}""",
            ExpectedVersion: null,
            ChangeSummary: null);

        var result = _validator.TestValidate(command);

        result.ShouldHaveValidationErrorFor(x => x.SnapshotJson)
            .WithErrorMessage("Invalid tooth identifier '99' in plan. Valid 2-digit FDI notation is required.");
    }

    [Fact]
    public void Validate_WhenFillingSurfacesIsNotArray_ShouldHaveValidationError()
    {
        var command = new SaveOdontogramCommand(
            EncounterId: Guid.NewGuid(),
            SnapshotJson: """{"version":"2.22","teeth":{"16":{"fillingSurfaces":"occlusal"}}}""",
            ExpectedVersion: null,
            ChangeSummary: null);

        var result = _validator.TestValidate(command);

        result.ShouldHaveValidationErrorFor(x => x.SnapshotJson)
            .WithErrorMessage("Tooth '16' fillingSurfaces in teeth must be an array.");
    }

    [Fact]
    public void Validate_WhenPerioMeasurementsAreValid_ShouldNotHaveAnyErrors()
    {
        var command = new SaveOdontogramCommand(
            EncounterId: Guid.NewGuid(),
            SnapshotJson: """
            {
                "version": "2.22",
                "teeth": {
                    "21": {
                        "perio": {
                            "pd": { "MB": 3, "B": 2, "DB": 3 },
                            "gm": { "MB": 0, "B": 1, "DB": 0 },
                            "bop": ["MB"],
                            "sup": []
                        }
                    }
                }
            }
            """,
            ExpectedVersion: null,
            ChangeSummary: null);

        var result = _validator.TestValidate(command);

        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_WhenSnapshotVersionIsUnsupportedFutureVersion_ShouldHaveValidationError()
    {
        var command = new SaveOdontogramCommand(
            EncounterId: Guid.NewGuid(),
            SnapshotJson: """{"version":"3.0","teeth":{}}""",
            ExpectedVersion: null,
            ChangeSummary: null);

        var result = _validator.TestValidate(command);

        result.ShouldHaveValidationErrorFor(x => x.SnapshotJson)
            .WithErrorMessage("Snapshot version '3.0' is not supported. Supported versions are <= 2.22.");
    }

    [Theory]
    [InlineData("1.4")]
    [InlineData("1.4.0")]
    [InlineData("1.10")]
    [InlineData("2.0")]
    [InlineData("2.3")]
    [InlineData("2.3.0")]
    [InlineData("2.4")]
    [InlineData("2.20")]
    [InlineData("2.21")]
    [InlineData("2.22")]
    [InlineData("2.22.0")]
    public void Validate_WhenSnapshotVersionIsSupportedLegacyOrCurrent_ShouldNotHaveValidationError(string version)
    {
        var command = new SaveOdontogramCommand(
            EncounterId: Guid.NewGuid(),
            SnapshotJson: "{\"version\":\"" + version + "\",\"teeth\":{}}",
            ExpectedVersion: null,
            ChangeSummary: null);

        var result = _validator.TestValidate(command);

        result.ShouldNotHaveValidationErrorFor(x => x.SnapshotJson);
    }

    [Theory]
    [InlineData("3.0")]
    [InlineData("2.23")]
    [InlineData("1.3")]
    [InlineData("1.0")]
    [InlineData("1.999")]
    [InlineData("2.22.invalid")]
    [InlineData("-1.4")]
    [InlineData("1.4.1.2")]
    [InlineData("2.22-beta")]
    [InlineData("invalid_version")]
    public void Validate_WhenSnapshotVersionIsUnsupportedOrMalformed_ShouldHaveValidationError(string invalidVersion)
    {
        var command = new SaveOdontogramCommand(
            EncounterId: Guid.NewGuid(),
            SnapshotJson: "{\"version\":\"" + invalidVersion + "\",\"teeth\":{}}",
            ExpectedVersion: null,
            ChangeSummary: null);

        var result = _validator.TestValidate(command);

        result.ShouldHaveValidationErrorFor(x => x.SnapshotJson)
            .WithErrorMessage($"Snapshot version '{invalidVersion}' is not supported. Supported versions are <= 2.22.");
    }

    [Fact]
    public void Validate_WhenCariesItemIsNotRecognizedSurface_ShouldHaveValidationError()
    {
        var command = new SaveOdontogramCommand(
            EncounterId: Guid.NewGuid(),
            SnapshotJson: """{"version":"2.22","teeth":{"11":{"caries":["invalid_surface_abc"]}}}""",
            ExpectedVersion: null,
            ChangeSummary: null);

        var result = _validator.TestValidate(command);

        result.ShouldHaveValidationErrorFor(x => x.SnapshotJson)
            .WithErrorMessage("Tooth '11' caries finding item 'invalid_surface_abc' in teeth is not a valid dental surface indicator.");
    }

    [Fact]
    public void Validate_WhenFillingSurfaceIsNotRecognized_ShouldHaveValidationError()
    {
        var command = new SaveOdontogramCommand(
            EncounterId: Guid.NewGuid(),
            SnapshotJson: """{"version":"2.22","teeth":{"11":{"fillingSurfaces":["bogus_surface"]}}}""",
            ExpectedVersion: null,
            ChangeSummary: null);

        var result = _validator.TestValidate(command);

        result.ShouldHaveValidationErrorFor(x => x.SnapshotJson)
            .WithErrorMessage("Tooth '11' filling surface 'bogus_surface' in teeth is not a valid dental surface indicator.");
    }

    [Fact]
    public void Validate_WhenRadixRemnantCarriesCoronalRestoration_ShouldHaveValidationError()
    {
        var command = new SaveOdontogramCommand(
            EncounterId: Guid.NewGuid(),
            SnapshotJson: """{"version":"2.22","teeth":{"14":{"toothSubstrate":"radix","restorationType":"crown"}}}""",
            ExpectedVersion: null,
            ChangeSummary: null);

        var result = _validator.TestValidate(command);

        result.ShouldHaveValidationErrorFor(x => x.SnapshotJson)
            .WithErrorMessage("Tooth '14' with substrate 'radix' cannot carry a coronal restoration (crown).");
    }

    [Fact]
    public void Validate_WhenPerioPdIsOutOfRange_ShouldHaveValidationError()
    {
        var command = new SaveOdontogramCommand(
            EncounterId: Guid.NewGuid(),
            SnapshotJson: """{"version":"2.22","teeth":{"11":{"perio":{"pd":{"B":25}}}}}""",
            ExpectedVersion: null,
            ChangeSummary: null);

        var result = _validator.TestValidate(command);

        result.ShouldHaveValidationErrorFor(x => x.SnapshotJson)
            .WithErrorMessage("Tooth '11' perio probing depth on 'B' must be between 0 and 15 mm.");
    }

    [Fact]
    public void Validate_WhenPerioSiteIsInvalid_ShouldHaveValidationError()
    {
        var command = new SaveOdontogramCommand(
            EncounterId: Guid.NewGuid(),
            SnapshotJson: """{"version":"2.22","teeth":{"11":{"perio":{"pd":{"NONEXISTENT_SITE":5}}}}}""",
            ExpectedVersion: null,
            ChangeSummary: null);

        var result = _validator.TestValidate(command);

        result.ShouldHaveValidationErrorFor(x => x.SnapshotJson)
            .WithErrorMessage("Tooth '11' perio probing depth has unrecognized site 'NONEXISTENT_SITE' in teeth.");
    }

    [Fact]
    public void Validate_WhenPerioGmIsOutOfRange_ShouldHaveValidationError()
    {
        var command = new SaveOdontogramCommand(
            EncounterId: Guid.NewGuid(),
            SnapshotJson: """{"version":"2.22","teeth":{"11":{"perio":{"gm":{"B":25}}}}}""",
            ExpectedVersion: null,
            ChangeSummary: null);

        var result = _validator.TestValidate(command);

        result.ShouldHaveValidationErrorFor(x => x.SnapshotJson)
            .WithErrorMessage("Tooth '11' perio gingival margin on 'B' must be between -10 and 20 mm.");
    }

    [Fact]
    public void Validate_WhenPerioBopContainsInvalidSite_ShouldHaveValidationError()
    {
        var command = new SaveOdontogramCommand(
            EncounterId: Guid.NewGuid(),
            SnapshotJson: """{"version":"2.22","teeth":{"11":{"perio":{"bop":["INVALID_BOP"]}}}}""",
            ExpectedVersion: null,
            ChangeSummary: null);

        var result = _validator.TestValidate(command);

        result.ShouldHaveValidationErrorFor(x => x.SnapshotJson)
            .WithErrorMessage("Tooth '11' perio bop site 'INVALID_BOP' in teeth is not a valid periodontal site.");
    }

    [Fact]
    public void Validate_WhenPerioAll6SitesValid_ShouldNotHaveAnyErrors()
    {
        var command = new SaveOdontogramCommand(
            EncounterId: Guid.NewGuid(),
            SnapshotJson: """
            {
                "version": "2.22",
                "teeth": {
                    "16": {
                        "toothSelection": "tooth-base",
                        "perio": {
                            "pd": { "MB": 3, "B": 2, "DB": 3, "ML": 4, "L": 3, "DL": 4 },
                            "gm": { "MB": 0, "B": -1, "DB": 0, "ML": 1, "L": 0, "DL": 0 },
                            "bop": ["MB", "DL"],
                            "sup": ["DL"]
                        }
                    }
                }
            }
            """,
            ExpectedVersion: null,
            ChangeSummary: null);

        var result = _validator.TestValidate(command);

        result.ShouldNotHaveAnyValidationErrors();
    }
}

