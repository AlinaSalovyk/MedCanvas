namespace MedCanvas.Tests.Data;

/// <summary>
/// Canonical clinical odontogram JSON fixtures generated directly from frontend v2.22 serialization contract
/// (serializeState(), defaultState(), and src/__tests__/parity/canonical-fixtures.ts).
/// The generated files are stored in Fixtures/generated/ and loaded dynamically with robust fallbacks.
/// </summary>
public static class ClinicalPayloadFixtures
{
    public const string CanonicalPayloadVersion = "2.22";

    private static readonly string FixturesDirectory = ResolveFixturesDirectory();

    private static string ResolveFixturesDirectory()
    {
        var baseDir = AppDomain.CurrentDomain.BaseDirectory;
        var candidates = new[]
        {
            Path.Combine(baseDir, "Fixtures", "generated"),
            Path.Combine(baseDir, "..", "..", "..", "..", "tests", "MedCanvas.Tests.Data", "Fixtures", "generated"),
            Path.Combine(baseDir, "..", "..", "..", "Fixtures", "generated"),
            Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", "..", "..", "backend", "tests", "MedCanvas.Tests.Data", "Fixtures", "generated"))
        };

        return candidates.FirstOrDefault(Directory.Exists)
            ?? Path.Combine(baseDir, "Fixtures", "generated");
    }

    public static string LoadGeneratedFixture(string filename)
    {
        var path = Path.Combine(FixturesDirectory, filename);
        if (File.Exists(path))
        {
            return File.ReadAllText(path);
        }

        throw new FileNotFoundException(
            $"Canonical frontend-generated fixture '{filename}' not found at '{path}'. " +
            "Run 'npm run fixtures:generate' to generate canonical contract fixtures.", path);
    }

    /// <summary>
    /// Minimal valid empty chart payload with empty teeth dictionary.
    /// Generated via frontend serializeState().
    /// </summary>
    public static readonly string EmptyChartPayload = LoadGeneratedFixture("empty-chart.json");

    /// <summary>
    /// Valid payload with multi-surface caries array, severity map, fillings, and crown restoration.
    /// Generated via frontend serializeState().
    /// </summary>
    public static readonly string CariesAndRestorationsPayload = LoadGeneratedFixture("caries-and-restorations.json");

    /// <summary>
    /// Clinical payload demonstrating Status chart alongside an independent Plan chart.
    /// Generated via frontend serializeState().
    /// </summary>
    public static readonly string StatusAndPlanPayload = LoadGeneratedFixture("status-and-plan.json");

    /// <summary>
    /// Payload with missing teeth (toothSelection = "none") and implant.
    /// Generated via frontend serializeState().
    /// </summary>
    public static readonly string ImplantsAndMissingTeethPayload = LoadGeneratedFixture("implants-and-missing-teeth.json");

    /// <summary>
    /// Payload with primary (deciduous) dentition using valid FDI keys 51..85 and milktooth finding.
    /// Generated via frontend serializeState().
    /// </summary>
    public static readonly string PrimaryAndMixedDentitionPayload = LoadGeneratedFixture("primary-and-mixed-dentition.json");

    /// <summary>
    /// Payload with endodontic treatment finding.
    /// Generated via frontend serializeState().
    /// </summary>
    public static readonly string EndodonticsPayload = LoadGeneratedFixture("endodontics.json");

    /// <summary>
    /// Payload with 6-site periodontal probing measurements (PD, GM, BOP, SUP).
    /// Generated via frontend serializeState().
    /// </summary>
    public static readonly string PeriodontalPayload = LoadGeneratedFixture("periodontal.json");

    /// <summary>
    /// Payload with Case Metadata.
    /// Generated via frontend serializeState().
    /// </summary>
    public static readonly string CaseMetadataPayload = LoadGeneratedFixture("case-metadata.json");

    /// <summary>
    /// Payload with custom plugin states (which must be preserved without loss).
    /// Generated via frontend serializeState().
    /// </summary>
    public static readonly string PluginCustomStatesPayload = LoadGeneratedFixture("plugin-custom-states.json");

    // =========================================================================
    // Negative Validation Fixtures (Manually curated synthetic boundary tests)
    // Note: The frontend serializer produces only structurally valid states by design.
    // The negative fixtures below are intentionally curated to test schema rejection.
    // =========================================================================

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
