using System.Text.Json;
using FluentValidation;

namespace MedCanvas.Application.Features.Odontograms;

public sealed class SaveOdontogramCommandValidator : AbstractValidator<SaveOdontogramCommand>
{
    private const int MaxSnapshotSizeBytes = 10 * 1024 * 1024; // 10 MB

    private static readonly HashSet<int> ValidFdiTeeth =
    [
        // Permanent dentition (quadrants 1-4)
        11, 12, 13, 14, 15, 16, 17, 18,
        21, 22, 23, 24, 25, 26, 27, 28,
        31, 32, 33, 34, 35, 36, 37, 38,
        41, 42, 43, 44, 45, 46, 47, 48,
        // Deciduous / Primary dentition (quadrants 5-8)
        51, 52, 53, 54, 55,
        61, 62, 63, 64, 65,
        71, 72, 73, 74, 75,
        81, 82, 83, 84, 85
    ];

    public SaveOdontogramCommandValidator()
    {
        RuleFor(x => x.EncounterId)
            .NotEmpty().WithMessage("Encounter identifier is required.");

        RuleFor(x => x.SnapshotJson)
            .NotEmpty().WithMessage("Snapshot JSON payload is required.")
            .Must(s => s != null && s.Length <= MaxSnapshotSizeBytes)
            .WithMessage("Snapshot payload exceeds maximum allowed size of 10 MB.")
            .Must(BeValidJson).WithMessage("Snapshot must be a valid serialized JSON document.")
            .Must(ContainRequiredOdontogramProperties).WithMessage("Snapshot payload must contain 'version' and 'teeth' root properties.")
            .Custom(ValidateClinicalPayloadStructure);

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
            return root.TryGetProperty("version", out var version) &&
                   version.ValueKind == JsonValueKind.String &&
                   !string.IsNullOrWhiteSpace(version.GetString()) &&
                   root.TryGetProperty("teeth", out var teeth) &&
                   teeth.ValueKind == JsonValueKind.Object;
        }
        catch
        {
            return false;
        }
    }

    private static void ValidateClinicalPayloadStructure(string json, ValidationContext<SaveOdontogramCommand> context)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            if (root.TryGetProperty("teeth", out var teethEl) && teethEl.ValueKind == JsonValueKind.Object)
            {
                ValidateTeethDictionary(teethEl, "teeth", context);
            }

            if (root.TryGetProperty("plan", out var planEl) && planEl.ValueKind == JsonValueKind.Object)
            {
                ValidateTeethDictionary(planEl, "plan", context);
            }

            if (root.TryGetProperty("globals", out var globalsEl) && globalsEl.ValueKind != JsonValueKind.Object)
            {
                context.AddFailure("SnapshotJson", "Snapshot 'globals' property must be a JSON object.");
            }

            if (root.TryGetProperty("case", out var caseEl) && caseEl.ValueKind != JsonValueKind.Object)
            {
                context.AddFailure("SnapshotJson", "Snapshot 'case' property must be a JSON object.");
            }
        }
        catch
        {
            // Json syntax errors are caught by BeValidJson
        }
    }

    private static void ValidateTeethDictionary(JsonElement teethEl, string containerName, ValidationContext<SaveOdontogramCommand> context)
    {
        foreach (var toothProp in teethEl.EnumerateObject())
        {
            var toothKey = toothProp.Name;

            if (!int.TryParse(toothKey, out var fdiNumber) || !ValidFdiTeeth.Contains(fdiNumber))
            {
                context.AddFailure("SnapshotJson", $"Invalid tooth identifier '{toothKey}' in {containerName}. Valid 2-digit FDI notation is required.");
                continue;
            }

            var toothVal = toothProp.Value;
            if (toothVal.ValueKind != JsonValueKind.Object)
            {
                context.AddFailure("SnapshotJson", $"Tooth record for FDI '{toothKey}' in {containerName} must be a JSON object.");
                continue;
            }

            ValidateToothRecord(toothKey, toothVal, containerName, context);
        }
    }

    private static void ValidateToothRecord(string toothKey, JsonElement tooth, string containerName, ValidationContext<SaveOdontogramCommand> context)
    {
        // 1. Caries validation: must be array of strings if present
        if (tooth.TryGetProperty("caries", out var cariesEl))
        {
            if (cariesEl.ValueKind != JsonValueKind.Array && cariesEl.ValueKind != JsonValueKind.Null)
            {
                context.AddFailure("SnapshotJson", $"Tooth '{toothKey}' caries finding in {containerName} must be an array of surface indicators.");
            }
            else if (cariesEl.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in cariesEl.EnumerateArray())
                {
                    if (item.ValueKind != JsonValueKind.String)
                    {
                        context.AddFailure("SnapshotJson", $"Tooth '{toothKey}' caries finding item in {containerName} must be a surface string.");
                        break;
                    }
                }
            }
        }

        // 2. CariesSeverity validation: must be object with 0..6 integer values
        if (tooth.TryGetProperty("cariesSeverity", out var severityEl))
        {
            if (severityEl.ValueKind != JsonValueKind.Object && severityEl.ValueKind != JsonValueKind.Null)
            {
                context.AddFailure("SnapshotJson", $"Tooth '{toothKey}' cariesSeverity in {containerName} must be a surface-to-severity map object.");
            }
            else if (severityEl.ValueKind == JsonValueKind.Object)
            {
                foreach (var severityProp in severityEl.EnumerateObject())
                {
                    if (severityProp.Value.ValueKind != JsonValueKind.Number ||
                        !severityProp.Value.TryGetInt32(out var grade) ||
                        grade < 0 || grade > 6)
                    {
                        context.AddFailure("SnapshotJson", $"Tooth '{toothKey}' caries severity on '{severityProp.Name}' in {containerName} must be an ICDAS/CARS integer between 0 and 6.");
                    }
                }
            }
        }

        // 3. Filling surfaces validation: must be array
        if (tooth.TryGetProperty("fillingSurfaces", out var fillingSurfacesEl) &&
            fillingSurfacesEl.ValueKind != JsonValueKind.Array && fillingSurfacesEl.ValueKind != JsonValueKind.Null)
        {
            context.AddFailure("SnapshotJson", $"Tooth '{toothKey}' fillingSurfaces in {containerName} must be an array.");
        }

        // 4. Filling surface materials: must be object
        if (tooth.TryGetProperty("fillingSurfaceMaterials", out var fsmEl) &&
            fsmEl.ValueKind != JsonValueKind.Object && fsmEl.ValueKind != JsonValueKind.Null)
        {
            context.AddFailure("SnapshotJson", $"Tooth '{toothKey}' fillingSurfaceMaterials in {containerName} must be a surface-to-material map object.");
        }

        // 5. Perio probing sub-record validation
        if (tooth.TryGetProperty("perio", out var perioEl) && perioEl.ValueKind != JsonValueKind.Null)
        {
            if (perioEl.ValueKind != JsonValueKind.Object)
            {
                context.AddFailure("SnapshotJson", $"Tooth '{toothKey}' perio measurements in {containerName} must be a JSON object.");
            }
            else
            {
                if (perioEl.TryGetProperty("pd", out var pdEl) && pdEl.ValueKind != JsonValueKind.Object && pdEl.ValueKind != JsonValueKind.Null)
                {
                    context.AddFailure("SnapshotJson", $"Tooth '{toothKey}' perio probing depths (pd) in {containerName} must be an object.");
                }

                if (perioEl.TryGetProperty("gm", out var gmEl) && gmEl.ValueKind != JsonValueKind.Object && gmEl.ValueKind != JsonValueKind.Null)
                {
                    context.AddFailure("SnapshotJson", $"Tooth '{toothKey}' perio gingival margins (gm) in {containerName} must be an object.");
                }

                if (perioEl.TryGetProperty("bop", out var bopEl) && bopEl.ValueKind != JsonValueKind.Array && bopEl.ValueKind != JsonValueKind.Null)
                {
                    context.AddFailure("SnapshotJson", $"Tooth '{toothKey}' perio bleeding on probing (bop) in {containerName} must be an array.");
                }

                if (perioEl.TryGetProperty("sup", out var supEl) && supEl.ValueKind != JsonValueKind.Array && supEl.ValueKind != JsonValueKind.Null)
                {
                    context.AddFailure("SnapshotJson", $"Tooth '{toothKey}' perio suppuration (sup) in {containerName} must be an array.");
                }
            }
        }
    }
}

