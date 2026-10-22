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
            if (doc.RootElement.TryGetProperty("teeth", out var teethEl) && teethEl.ValueKind == JsonValueKind.Object)
            {
                foreach (var toothProp in teethEl.EnumerateObject())
                {
                    var toothFdi = toothProp.Name;
                    var toothData = toothProp.Value;

                    // Check Caries
                    if (toothData.TryGetProperty("caries", out var cariesEl) && cariesEl.ValueKind == JsonValueKind.Object)
                    {
                        foreach (var surfaceProp in cariesEl.EnumerateObject())
                        {
                            entries.Add(new JsonObject
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
                                                ["code"] = "80967001",
                                                ["display"] = "Dental caries"
                                            }
                                        },
                                        ["text"] = $"Caries on Tooth FDI {toothFdi} ({surfaceProp.Name} surface)"
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
                                        ["reference"] = $"urn:uuid:{patient.Id}"
                                    }
                                }
                            });
                        }
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
}
