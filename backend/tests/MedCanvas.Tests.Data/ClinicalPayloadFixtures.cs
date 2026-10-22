namespace MedCanvas.Tests.Data;

/// <summary>
/// Canonical clinical odontogram JSON fixtures generated directly from frontend v2.22 serialization contract
/// (serializeState(), collectExportPayload(), and native import/export tests).
/// Replaces artificial incompatible test payloads that used object-based caries or non-FDI teeth.
/// </summary>
public static class ClinicalPayloadFixtures
{
    public const string CanonicalPayloadVersion = "2.22";

    /// <summary>
    /// Minimal valid empty chart payload with empty teeth dictionary.
    /// </summary>
    public const string EmptyChartPayload = """
    {
        "version": "2.22",
        "globals": {
            "wisdomVisible": true,
            "showBase": true,
            "occlusalVisible": true,
            "showHealthyPulp": false,
            "edentulous": false
        },
        "teeth": {}
    }
    """;

    /// <summary>
    /// Valid payload with multi-surface caries array, severity map, fillings, and crown restoration.
    /// Matches frontend serializeState() representation.
    /// </summary>
    public const string CariesAndRestorationsPayload = """
    {
        "version": "2.22",
        "globals": {
            "wisdomVisible": true,
            "showBase": true,
            "occlusalVisible": true,
            "showHealthyPulp": false,
            "edentulous": false
        },
        "teeth": {
            "11": {
                "toothSelection": "tooth-base",
                "caries": ["caries-distal", "caries-mesial"],
                "cariesActiveDepth": 2,
                "cariesSeverity": {
                    "distal": 3,
                    "mesial": 2
                },
                "restorationType": "none",
                "restorationMaterial": "none",
                "mobility": "none"
            },
            "16": {
                "toothSelection": "implant",
                "caries": [],
                "restorationType": "crown",
                "restorationMaterial": "zircon",
                "mobility": "none"
            },
            "21": {
                "toothSelection": "tooth-base",
                "caries": [],
                "fillingSurfaces": ["occlusal"],
                "fillingSurfaceMaterials": {
                    "occlusal": "composite"
                },
                "restorationType": "none",
                "restorationMaterial": "none"
            },
            "26": {
                "toothSelection": "tooth-base",
                "caries": ["caries-occlusal"],
                "cariesSeverity": {
                    "occlusal": 4
                },
                "restorationType": "none",
                "restorationMaterial": "none"
            }
        }
    }
    """;

    /// <summary>
    /// Clinical payload demonstrating Status chart alongside an independent Plan chart.
    /// </summary>
    public const string StatusAndPlanPayload = """
    {
        "version": "2.22",
        "globals": {
            "wisdomVisible": true,
            "showBase": true,
            "occlusalVisible": true,
            "showHealthyPulp": false,
            "edentulous": false
        },
        "teeth": {
            "11": {
                "toothSelection": "tooth-base",
                "caries": ["caries-distal"],
                "cariesSeverity": {
                    "distal": 3
                },
                "restorationType": "none"
            }
        },
        "plan": {
            "11": {
                "toothSelection": "tooth-base",
                "caries": [],
                "fillingSurfaces": ["distal"],
                "fillingSurfaceMaterials": {
                    "distal": "composite"
                },
                "planRestoration": {
                    "type": "composite",
                    "shade": "A2"
                }
            }
        }
    }
    """;

    /// <summary>
    /// Payload with missing teeth (toothSelection = "none") and implant.
    /// </summary>
    public const string ImplantsAndMissingTeethPayload = """
    {
        "version": "2.22",
        "globals": {
            "wisdomVisible": true,
            "showBase": true,
            "occlusalVisible": true
        },
        "teeth": {
            "18": { "toothSelection": "none" },
            "28": { "toothSelection": "none" },
            "38": { "toothSelection": "none" },
            "48": { "toothSelection": "none" },
            "16": {
                "toothSelection": "implant",
                "restorationType": "crown",
                "restorationMaterial": "zircon"
            },
            "21": { "toothSelection": "tooth-base" }
        }
    }
    """;

    /// <summary>
    /// Payload with primary (deciduous) dentition using valid FDI keys 51..85 and milktooth finding.
    /// </summary>
    public const string PrimaryAndMixedDentitionPayload = """
    {
        "version": "2.22",
        "globals": { "wisdomVisible": false },
        "teeth": {
            "51": {
                "toothSelection": "milktooth",
                "caries": ["caries-mesial"],
                "cariesSeverity": { "mesial": 2 }
            },
            "55": { "toothSelection": "milktooth" },
            "61": { "toothSelection": "milktooth" },
            "71": { "toothSelection": "milktooth" },
            "85": { "toothSelection": "milktooth" }
        }
    }
    """;

    /// <summary>
    /// Payload with endodontic treatment finding.
    /// </summary>
    public const string EndodonticsPayload = """
    {
        "version": "2.22",
        "teeth": {
            "36": {
                "toothSelection": "tooth-base",
                "endo": "endo-filling",
                "periapicalType": "none",
                "mods": ["root-filling"]
            }
        }
    }
    """;

    /// <summary>
    /// Payload with 6-site periodontal probing measurements (PD, GM, BOP, SUP).
    /// </summary>
    public const string PeriodontalPayload = """
    {
        "version": "2.22",
        "teeth": {
            "11": {
                "toothSelection": "tooth-base",
                "perio": {
                    "pd": { "MB": 4, "B": 2, "DB": 3, "ML": 3, "L": 2, "DL": 4 },
                    "gm": { "MB": 1, "B": 0, "DB": 0, "ML": 0, "L": 0, "DL": 1 },
                    "bop": ["MB", "DL"],
                    "sup": []
                }
            }
        }
    }
    """;

    /// <summary>
    /// Payload with Case Metadata.
    /// </summary>
    public const string CaseMetadataPayload = """
    {
        "version": "2.22",
        "teeth": {
            "11": { "toothSelection": "tooth-base" }
        },
        "case": {
            "patientName": "Synthetic Test Patient",
            "notes": "Non-identifying synthetic test case notes"
        }
    }
    """;

    /// <summary>
    /// Payload with custom plugin states (which must be preserved without loss).
    /// </summary>
    public const string PluginCustomStatesPayload = """
    {
        "version": "2.22",
        "teeth": {
            "11": {
                "toothSelection": "tooth-base",
                "customStates": {
                    "orthoSensorPlugin": {
                        "forceGrams": 45.5,
                        "bracketId": "BR-11"
                    }
                }
            }
        }
    }
    """;

    /// <summary>
    /// Malformed payload with artificial object-based caries (contrary to frontend array serialization).
    /// Used to test validation rejection.
    /// </summary>
    public const string MalformedObjectCariesPayload = """
    {
        "version": "2.22",
        "teeth": {
            "11": {
                "caries": {
                    "distal": { "icdas": 2 }
                }
            }
        }
    }
    """;

    /// <summary>
    /// Malformed payload with non-FDI tooth identifier (e.g. 99).
    /// </summary>
    public const string MalformedNonFdiToothPayload = """
    {
        "version": "2.22",
        "teeth": {
            "99": {
                "toothSelection": "tooth-base"
            }
        }
    }
    """;

    /// <summary>
    /// Malformed payload with out-of-range ICDAS severity (> 6).
    /// </summary>
    public const string MalformedOutOfRangeSeverityPayload = """
    {
        "version": "2.22",
        "teeth": {
            "11": {
                "caries": ["caries-distal"],
                "cariesSeverity": { "distal": 9 }
            }
        }
    }
    """;
}
