using System.Text.Json;
using FluentValidation;

namespace MedCanvas.Application.Features.Odontograms;

public sealed class SaveOdontogramCommandValidator : AbstractValidator<SaveOdontogramCommand>
{
    public SaveOdontogramCommandValidator()
    {
        RuleFor(x => x.EncounterId)
            .NotEmpty().WithMessage("Encounter identifier is required.");

        RuleFor(x => x.SnapshotJson)
            .NotEmpty().WithMessage("Snapshot JSON payload is required.")
            .Must(BeValidJson).WithMessage("Snapshot must be a valid serialized JSON document.")
            .Must(ContainRequiredOdontogramProperties).WithMessage("Snapshot payload must contain 'version' and 'teeth' root properties.");

        RuleFor(x => x.ChangeSummary)
            .MaximumLength(500).WithMessage("Change summary cannot exceed 500 characters.")
            .When(x => !string.IsNullOrWhiteSpace(x.ChangeSummary));
    }

    private static bool BeValidJson(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.ValueKind == JsonValueKind.Object;
        }
        catch
        {
            return false;
        }
    }

    private static bool ContainRequiredOdontogramProperties(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            return root.TryGetProperty("version", out _) && root.TryGetProperty("teeth", out _);
        }
        catch
        {
            return false;
        }
    }
}
