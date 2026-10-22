using System.Text;
using System.Text.Json;
using FluentValidation;

namespace MedCanvas.Application.Features.Odontograms;

public sealed class SaveOdontogramCommandValidator : AbstractValidator<SaveOdontogramCommand>
{
    private const int MaxSnapshotSizeBytes = 10 * 1024 * 1024; // 10 MB
    private const int MaxJsonNestingDepth = 32;

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

    private static readonly HashSet<string> AllowedCariesSurfaces =
    [
        "buccal", "lingual", "mesial", "distal", "occlusal", "incisal", "subcrown",
        "caries-buccal", "caries-lingual", "caries-mesial", "caries-distal", "caries-occlusal", "caries-incisal", "caries-subcrown",
        "subcaries-buccal", "subcaries-lingual", "subcaries-mesial", "subcaries-distal", "subcaries-occlusal", "subcaries-incisal", "subcaries-subcrown"
    ];

    private static readonly HashSet<string> AllowedFillingSurfaces =
    [
        "buccal", "lingual", "mesial", "distal", "occlusal", "incisal",
        "filling-buccal", "filling-lingual", "filling-mesial", "filling-distal", "filling-occlusal", "filling-incisal"
    ];

    private static readonly HashSet<string> AllowedRestorationTypes =
    [
        "none", "crown", "inlay", "onlay", "veneer", "bridge"
    ];

    private static readonly HashSet<string> AllowedRestorationMaterials =
    [
        "none", "emax", "gold", "gradia", "zircon", "metal", "metal-ceramic", "telescope", "temporary"
    ];

    private static readonly HashSet<string> AllowedToothSubstrates =
    [
        "natural", "radix", "broken", "crownprep"
    ];

    private static readonly HashSet<string> AllowedToothSelections =
    [
        "none", "tooth-base", "milktooth", "implant", "tooth-under-gum", "no-tooth-after-extraction"
    ];

    private static readonly HashSet<string> AllowedEndoStates =
    [
        "none", "endo-medical-filling", "endo-filling", "endo-filling-incomplete", "endo-glass-pin", "endo-metal-pin"
    ];

    public SaveOdontogramCommandValidator()
    {
        RuleFor(x => x.EncounterId)
            .NotEmpty().WithMessage("Encounter identifier is required.");

        RuleFor(x => x.SnapshotJson)
            .NotEmpty().WithMessage("Snapshot JSON payload is required.")
            .Must(s => s != null && Encoding.UTF8.GetByteCount(s) <= MaxSnapshotSizeBytes)
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
            var options = new JsonDocumentOptions { MaxDepth = MaxJsonNestingDepth };
            using var doc = JsonDocument.Parse(json, options);
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
            var options = new JsonDocumentOptions { MaxDepth = MaxJsonNestingDepth };
            using var doc = JsonDocument.Parse(json, options);
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

    public static bool IsSupportedVersion(string version)
    {
        if (string.IsNullOrWhiteSpace(version)) return false;

        var parts = version.Trim().Split('.');
        if (parts.Length == 0 || !int.TryParse(parts[0], out var major)) return false;
        if (!int.TryParse(parts.Length > 1 ? parts[1] : "0", out var minor)) return false;

        // Supported versions: 1.x or 2.x up to 2.22
        if (major == 1) return true;
        if (major == 2 && minor <= 22) return true;
        return false;
    }

    private static void ValidateClinicalPayloadStructure(string json, ValidationContext<SaveOdontogramCommand> context)
    {
        try
        {
            var options = new JsonDocumentOptions { MaxDepth = MaxJsonNestingDepth };
            using var doc = JsonDocument.Parse(json, options);
            var root = doc.RootElement;

            if (root.TryGetProperty("version", out var versionEl) && versionEl.ValueKind == JsonValueKind.String)
            {
                var versionStr = versionEl.GetString() ?? "";
                if (!IsSupportedVersion(versionStr))
                {
                    context.AddFailure("SnapshotJson", $"Snapshot version '{versionStr}' is not supported. Supported versions are <= 2.22.");
                }
            }

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
            // Syntax/nesting errors are caught by BeValidJson
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
        // 1. Tooth selection enum
        if (tooth.TryGetProperty("toothSelection", out var tsEl) && tsEl.ValueKind == JsonValueKind.String)
        {
            var ts = tsEl.GetString();
            if (ts != null && !AllowedToothSelections.Contains(ts))
            {
                context.AddFailure("SnapshotJson", $"Tooth '{toothKey}' toothSelection '{ts}' in {containerName} is not a recognized clinical value.");
            }
        }

        // 2. Tooth substrate enum
        string? toothSubstrate = null;
        if (tooth.TryGetProperty("toothSubstrate", out var subEl) && subEl.ValueKind == JsonValueKind.String)
        {
            toothSubstrate = subEl.GetString();
            if (toothSubstrate != null && !AllowedToothSubstrates.Contains(toothSubstrate))
            {
                context.AddFailure("SnapshotJson", $"Tooth '{toothKey}' toothSubstrate '{toothSubstrate}' in {containerName} is not a recognized clinical value.");
            }
        }

        // 3. Restoration type and radix invariant
        string? restorationType = null;
        if (tooth.TryGetProperty("restorationType", out var rtEl) && rtEl.ValueKind == JsonValueKind.String)
        {
            restorationType = rtEl.GetString();
            if (restorationType != null && !AllowedRestorationTypes.Contains(restorationType))
            {
                context.AddFailure("SnapshotJson", $"Tooth '{toothKey}' restorationType '{restorationType}' in {containerName} is not a recognized clinical value.");
            }
        }

        if (toothSubstrate == "radix" && restorationType != null && restorationType != "none")
        {
            context.AddFailure("SnapshotJson", $"Tooth '{toothKey}' with substrate 'radix' cannot carry a coronal restoration ({restorationType}).");
        }

        // 4. Restoration material
        if (tooth.TryGetProperty("restorationMaterial", out var rmEl) && rmEl.ValueKind == JsonValueKind.String)
        {
            var rm = rmEl.GetString();
            if (rm != null && !AllowedRestorationMaterials.Contains(rm))
            {
                context.AddFailure("SnapshotJson", $"Tooth '{toothKey}' restorationMaterial '{rm}' in {containerName} is not a recognized clinical value.");
            }
        }

        // 5. Endo status
        if (tooth.TryGetProperty("endo", out var endoEl) && endoEl.ValueKind == JsonValueKind.String)
        {
            var endo = endoEl.GetString();
            if (endo != null && !AllowedEndoStates.Contains(endo))
            {
                context.AddFailure("SnapshotJson", $"Tooth '{toothKey}' endo '{endo}' in {containerName} is not a recognized clinical value.");
            }
        }

        // 6. Caries validation: must be array of allowed surface strings
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

                    var surfaceStr = item.GetString();
                    if (surfaceStr != null && !AllowedCariesSurfaces.Contains(surfaceStr))
                    {
                        context.AddFailure("SnapshotJson", $"Tooth '{toothKey}' caries finding item '{surfaceStr}' in {containerName} is not a valid dental surface indicator.");
                    }
                }
            }
        }

        // 7. CariesSeverity validation: must be object with 0..6 integer values
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

        // 8. Filling surfaces validation: must be array of allowed filling surfaces
        if (tooth.TryGetProperty("fillingSurfaces", out var fillingSurfacesEl))
        {
            if (fillingSurfacesEl.ValueKind != JsonValueKind.Array && fillingSurfacesEl.ValueKind != JsonValueKind.Null)
            {
                context.AddFailure("SnapshotJson", $"Tooth '{toothKey}' fillingSurfaces in {containerName} must be an array.");
            }
            else if (fillingSurfacesEl.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in fillingSurfacesEl.EnumerateArray())
                {
                    if (item.ValueKind == JsonValueKind.String)
                    {
                        var surf = item.GetString();
                        if (surf != null && !AllowedFillingSurfaces.Contains(surf))
                        {
                            context.AddFailure("SnapshotJson", $"Tooth '{toothKey}' filling surface '{surf}' in {containerName} is not a valid dental surface indicator.");
                        }
                    }
                }
            }
        }

        // 9. Filling surface materials: must be object
        if (tooth.TryGetProperty("fillingSurfaceMaterials", out var fsmEl) &&
            fsmEl.ValueKind != JsonValueKind.Object && fsmEl.ValueKind != JsonValueKind.Null)
        {
            context.AddFailure("SnapshotJson", $"Tooth '{toothKey}' fillingSurfaceMaterials in {containerName} must be a surface-to-material map object.");
        }

        // 10. Perio probing sub-record validation
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
                else if (pdEl.ValueKind == JsonValueKind.Object)
                {
                    foreach (var pdProp in pdEl.EnumerateObject())
                    {
                        if (pdProp.Value.ValueKind == JsonValueKind.Number && pdProp.Value.TryGetDouble(out var pdVal))
                        {
                            if (pdVal < 0 || pdVal > 15)
                            {
                                context.AddFailure("SnapshotJson", $"Tooth '{toothKey}' perio probing depth on '{pdProp.Name}' must be between 0 and 15 mm.");
                            }
                        }
                    }
                }

                if (perioEl.TryGetProperty("gm", out var gmEl) && gmEl.ValueKind != JsonValueKind.Object && gmEl.ValueKind != JsonValueKind.Null)
                {
                    context.AddFailure("SnapshotJson", $"Tooth '{toothKey}' perio gingival margins (gm) in {containerName} must be an object.");
                }
                else if (gmEl.ValueKind == JsonValueKind.Object)
                {
                    foreach (var gmProp in gmEl.EnumerateObject())
                    {
                        if (gmProp.Value.ValueKind == JsonValueKind.Number && gmProp.Value.TryGetDouble(out var gmVal))
                        {
                            if (gmVal < -10 || gmVal > 15)
                            {
                                context.AddFailure("SnapshotJson", $"Tooth '{toothKey}' perio gingival margin on '{gmProp.Name}' must be between -10 and 15 mm.");
                            }
                        }
                    }
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
