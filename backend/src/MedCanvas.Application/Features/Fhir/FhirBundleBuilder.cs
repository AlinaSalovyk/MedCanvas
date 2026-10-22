using System.Text.Json;
using System.Text.Json.Nodes;
using MedCanvas.Domain.Entities;

namespace MedCanvas.Application.Features.Fhir;

public static class FhirBundleBuilder
{
    public static string BuildBundle(
        Clinic clinic,
        Patient patient,
        DentalEncounter encounter,
        OdontogramRecord record)
    {
        var bundleId = Guid.NewGuid().ToString();
        var entries = new JsonArray();

        // 1. Organization (Clinic)
        entries.Add(new JsonObject
        {
            ["fullUrl"] = $"urn:uuid:{clinic.Id}",
            ["resource"] = new JsonObject
            {
                ["resourceType"] = "Organization",
                ["id"] = clinic.Id.ToString(),
                ["name"] = clinic.Name,
                ["identifier"] = new JsonArray
                {
                    new JsonObject
                    {
                        ["system"] = "https://medcanvas.health/fhir/clinic-identifier",
                        ["value"] = clinic.Identifier
                    }
                }
            }
        });

        // 2. Patient
        entries.Add(new JsonObject
        {
            ["fullUrl"] = $"urn:uuid:{patient.Id}",
            ["resource"] = new JsonObject
            {
                ["resourceType"] = "Patient",
                ["id"] = patient.Id.ToString(),
                ["name"] = new JsonArray
                {
                    new JsonObject
                    {
                        ["use"] = "official",
                        ["family"] = patient.LastName,
                        ["given"] = new JsonArray { patient.FirstName }
                    }
                },
                ["gender"] = patient.Gender?.ToLowerInvariant() switch
                {
                    "male" => "male",
                    "female" => "female",
                    _ => "unknown"
                },
                ["birthDate"] = patient.DateOfBirth?.ToString("yyyy-MM-dd")
            }
        });

        // 3. Encounter
        entries.Add(new JsonObject
        {
            ["fullUrl"] = $"urn:uuid:{encounter.Id}",
            ["resource"] = new JsonObject
            {
                ["resourceType"] = "Encounter",
                ["id"] = encounter.Id.ToString(),
                ["status"] = encounter.Status.ToString().ToLowerInvariant(),
                ["class"] = new JsonObject
                {
                    ["system"] = "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                    ["code"] = "AMB",
                    ["display"] = "ambulatory"
                },
                ["subject"] = new JsonObject
                {
                    ["reference"] = $"urn:uuid:{patient.Id}",
                    ["display"] = patient.FullName
                },
                ["period"] = new JsonObject
                {
                    ["start"] = encounter.EncounterDateUtc.ToString("o")
                }
            }
        });

        // 4. Clinical observations/conditions parsed from SnapshotJson
        try
        {
            using var doc = JsonDocument.Parse(record.SnapshotJson);
            var root = doc.RootElement;

            if (root.TryGetProperty("teeth", out var teethEl) && teethEl.ValueKind == JsonValueKind.Object)
            {
                foreach (var toothProp in teethEl.EnumerateObject())
                {
                    var toothFdi = toothProp.Name;
                    var toothData = toothProp.Value;

                    if (toothData.ValueKind != JsonValueKind.Object)
                    {
                        continue;
                    }

                    // A. Tooth Selection: Missing tooth vs Implant
                    if (toothData.TryGetProperty("toothSelection", out var selEl) && selEl.ValueKind == JsonValueKind.String)
                    {
                        var sel = selEl.GetString();
                        if (sel == "none" || sel == "no-tooth-after-extraction")
                        {
                            entries.Add(CreateConditionEntry(
                                patient.Id, encounter.Id, toothFdi,
                                snomedCode: "25540007",
                                snomedDisplay: "Missing tooth",
                                conditionText: $"Missing Tooth FDI {toothFdi}"));
                        }
                        else if (sel == "implant")
                        {
                            entries.Add(CreateConditionEntry(
                                patient.Id, encounter.Id, toothFdi,
                                snomedCode: "272676008",
                                snomedDisplay: "Dental implant present",
                                conditionText: $"Dental implant at Tooth FDI {toothFdi}"));
                        }
                    }

                    // B. Check Caries (Frontend serialization is Array of strings; object supported as fallback)
                    if (toothData.TryGetProperty("caries", out var cariesEl))
                    {
                        var severityMap = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
                        if (toothData.TryGetProperty("cariesSeverity", out var sevEl) && sevEl.ValueKind == JsonValueKind.Object)
                        {
                            foreach (var sProp in sevEl.EnumerateObject())
                            {
                                if (sProp.Value.ValueKind == JsonValueKind.Number && sProp.Value.TryGetInt32(out var g))
                                {
                                    severityMap[sProp.Name] = g;
                                }
                            }
                        }

                        if (cariesEl.ValueKind == JsonValueKind.Array)
                        {
                            foreach (var item in cariesEl.EnumerateArray())
                            {
                                if (item.ValueKind == JsonValueKind.String)
                                {
                                    var rawSurface = item.GetString() ?? string.Empty;
                                    var surface = rawSurface.StartsWith("caries-", StringComparison.OrdinalIgnoreCase)
                                        ? rawSurface[7..]
                                        : (rawSurface.StartsWith("subcaries-", StringComparison.OrdinalIgnoreCase)
                                            ? rawSurface[10..]
                                            : rawSurface);

                                    var severityText = severityMap.TryGetValue(surface, out var grade)
                                        ? $", ICDAS {grade}"
                                        : string.Empty;

                                    entries.Add(CreateConditionEntry(
                                        patient.Id, encounter.Id, toothFdi,
                                        snomedCode: "80967001",
                                        snomedDisplay: "Dental caries",
                                        conditionText: $"Caries on Tooth FDI {toothFdi} ({surface} surface{severityText})"));
                                }
                            }
                        }
                        else if (cariesEl.ValueKind == JsonValueKind.Object)
                        {
                            // Fallback for legacy fixtures
                            foreach (var surfaceProp in cariesEl.EnumerateObject())
                            {
                                entries.Add(CreateConditionEntry(
                                    patient.Id, encounter.Id, toothFdi,
                                    snomedCode: "80967001",
                                    snomedDisplay: "Dental caries",
                                    conditionText: $"Caries on Tooth FDI {toothFdi} ({surfaceProp.Name} surface)"));
                            }
                        }
                    }

                    // C. Restorations / Fixed Prosthetics
                    if (toothData.TryGetProperty("restorationType", out var restTypeEl) &&
                        restTypeEl.ValueKind == JsonValueKind.String)
                    {
                        var restType = restTypeEl.GetString();
                        if (!string.IsNullOrWhiteSpace(restType) && restType != "none")
                        {
                            var material = toothData.TryGetProperty("restorationMaterial", out var matEl) && matEl.ValueKind == JsonValueKind.String
                                ? matEl.GetString()
                                : null;

                            var matText = !string.IsNullOrWhiteSpace(material) && material != "none" ? $", material: {material}" : string.Empty;

                            entries.Add(CreateConditionEntry(
                                patient.Id, encounter.Id, toothFdi,
                                snomedCode: "118624004",
                                snomedDisplay: "Dental restoration finding",
                                conditionText: $"Restoration ({restType}{matText}) on Tooth FDI {toothFdi}"));
                        }
                    }

                    // D. Fillings (Surfaces + Materials)
                    if (toothData.TryGetProperty("fillingSurfaces", out var fillSurfacesEl) &&
                        fillSurfacesEl.ValueKind == JsonValueKind.Array)
                    {
                        var fillMaterials = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                        if (toothData.TryGetProperty("fillingSurfaceMaterials", out var fsmEl) && fsmEl.ValueKind == JsonValueKind.Object)
                        {
                            foreach (var prop in fsmEl.EnumerateObject())
                            {
                                if (prop.Value.ValueKind == JsonValueKind.String)
                                {
                                    fillMaterials[prop.Name] = prop.Value.GetString() ?? string.Empty;
                                }
                            }
                        }

                        foreach (var surfItem in fillSurfacesEl.EnumerateArray())
                        {
                            if (surfItem.ValueKind == JsonValueKind.String)
                            {
                                var surface = surfItem.GetString() ?? string.Empty;
                                var mat = fillMaterials.TryGetValue(surface, out var m) && !string.IsNullOrWhiteSpace(m) ? $", material: {m}" : string.Empty;

                                entries.Add(CreateConditionEntry(
                                    patient.Id, encounter.Id, toothFdi,
                                    snomedCode: "118624004",
                                    snomedDisplay: "Dental restoration finding",
                                    conditionText: $"Filling on Tooth FDI {toothFdi} ({surface} surface{mat})"));
                            }
                        }
                    }

                    // E. Endodontics
                    if (toothData.TryGetProperty("endo", out var endoEl) && endoEl.ValueKind == JsonValueKind.String)
                    {
                        var endo = endoEl.GetString();
                        if (!string.IsNullOrWhiteSpace(endo) && endo != "none")
                        {
                            entries.Add(CreateConditionEntry(
                                patient.Id, encounter.Id, toothFdi,
                                snomedCode: "234737002",
                                snomedDisplay: "Root canal therapy finding",
                                conditionText: $"Endodontic treatment on Tooth FDI {toothFdi} ({endo})"));
                        }
                    }
                }
            }

            // 5. Planned Interventions as FHIR ServiceRequests (intent = "plan")
            if (root.TryGetProperty("plan", out var planEl) && planEl.ValueKind == JsonValueKind.Object)
            {
                foreach (var planToothProp in planEl.EnumerateObject())
                {
                    var toothFdi = planToothProp.Name;
                    var planData = planToothProp.Value;

                    if (planData.ValueKind != JsonValueKind.Object)
                    {
                        continue;
                    }

                    if (planData.TryGetProperty("planRestoration", out var planRestEl) ||
                        (planData.TryGetProperty("restorationType", out var pRestType) && pRestType.ValueKind == JsonValueKind.String && pRestType.GetString() != "none"))
                    {
                        entries.Add(new JsonObject
                        {
                            ["fullUrl"] = $"urn:uuid:{Guid.NewGuid()}",
                            ["resource"] = new JsonObject
                            {
                                ["resourceType"] = "ServiceRequest",
                                ["status"] = "active",
                                ["intent"] = "plan",
                                ["subject"] = new JsonObject
                                {
                                    ["reference"] = $"urn:uuid:{patient.Id}"
                                },
                                ["encounter"] = new JsonObject
                                {
                                    ["reference"] = $"urn:uuid:{encounter.Id}"
                                },
                                ["code"] = new JsonObject
                                {
                                    ["coding"] = new JsonArray
                                    {
                                        new JsonObject
                                        {
                                            ["system"] = "http://snomed.info/sct",
                                            ["code"] = "281691000",
                                            ["display"] = "Dental procedure"
                                        }
                                    },
                                    ["text"] = $"Planned dental restoration on Tooth FDI {toothFdi}"
                                },
                                ["bodySite"] = new JsonArray
                                {
                                    new JsonObject
                                    {
                                        ["coding"] = new JsonArray
                                        {
                                            new JsonObject
                                            {
                                                ["system"] = "http://fdi.org/iso3950",
                                                ["code"] = toothFdi,
                                                ["display"] = $"Tooth {toothFdi}"
                                            }
                                        }
                                    }
                                }
                            }
                        });
                    }
                }
            }
        }
        catch
        {
            // Fallback gracefully on unparseable tooth data
        }

        var bundle = new JsonObject
        {
            ["resourceType"] = "Bundle",
            ["id"] = bundleId,
            ["type"] = "collection",
            ["timestamp"] = DateTime.UtcNow.ToString("o"),
            ["entry"] = entries
        };

        return bundle.ToJsonString(new JsonSerializerOptions { WriteIndented = true });
    }

    private static JsonObject CreateConditionEntry(
        Guid patientId,
        Guid encounterId,
        string toothFdi,
        string snomedCode,
        string snomedDisplay,
        string conditionText)
    {
        return new JsonObject
        {
            ["fullUrl"] = $"urn:uuid:{Guid.NewGuid()}",
            ["resource"] = new JsonObject
            {
                ["resourceType"] = "Condition",
                ["clinicalStatus"] = new JsonObject
                {
                    ["coding"] = new JsonArray
                    {
                        new JsonObject
                        {
                            ["system"] = "http://terminology.hl7.org/CodeSystem/condition-clinical",
                            ["code"] = "active"
                        }
                    }
                },
                ["category"] = new JsonArray
                {
                    new JsonObject
                    {
                        ["coding"] = new JsonArray
                        {
                            new JsonObject
                            {
                                ["system"] = "http://terminology.hl7.org/CodeSystem/condition-category",
                                ["code"] = "encounter-diagnosis"
                            }
                        }
                    }
                },
                ["code"] = new JsonObject
                {
                    ["coding"] = new JsonArray
                    {
                        new JsonObject
                        {
                            ["system"] = "http://snomed.info/sct",
                            ["code"] = snomedCode,
                            ["display"] = snomedDisplay
                        }
                    },
                    ["text"] = conditionText
                },
                ["bodySite"] = new JsonArray
                {
                    new JsonObject
                    {
                        ["coding"] = new JsonArray
                        {
                            new JsonObject
                            {
                                ["system"] = "http://fdi.org/iso3950",
                                ["code"] = toothFdi,
                                ["display"] = $"Tooth {toothFdi}"
                            }
                        }
                    }
                },
                ["subject"] = new JsonObject
                {
                    ["reference"] = $"urn:uuid:{patientId}"
                },
                ["encounter"] = new JsonObject
                {
                    ["reference"] = $"urn:uuid:{encounterId}"
                }
            }
        };
    }
}
