using System.Text.Json;
using FluentAssertions;
using MedCanvas.Application.Features.Fhir;
using MedCanvas.Domain.Entities;
using MedCanvas.Domain.Enums;
using MedCanvas.Tests.Data;
using Xunit;

namespace MedCanvas.Application.Tests.Features.Fhir;

public class FhirBundleBuilderTests
{
    private readonly Clinic _clinic;
    private readonly User _user;
    private readonly Patient _patient;
    private readonly DentalEncounter _encounter;
    private readonly DateTime _now = DateTime.UtcNow;

    public FhirBundleBuilderTests()
    {
        _clinic = Clinic.Create("Smile Dental Clinic", "SMILE-01", _now);
        _user = User.Create("dr.dentist@smiledental.com", "Dr. Dentist", "dummy_hash", _now);
        _patient = Patient.Create(_clinic.Id, "Taras", "Shevchenko", new DateOnly(1814, 3, 9), "Male", "+380501112233", "taras@example.com", "MRN-101", null, _now);
        _encounter = DentalEncounter.Start(_clinic.Id, _patient.Id, _user.Id, _now, "General checkup", _now);
    }

    [Fact]
    public void BuildBundle_WithCariesAndRestorations_EmitsConditionsWithValidReferencesAndCodes()
    {
        var record = OdontogramRecord.Create(_clinic.Id, _patient.Id, _encounter.Id, "2.22", ClinicalPayloadFixtures.CariesAndRestorationsPayload, _now);

        var bundleJson = FhirBundleBuilder.BuildBundle(_clinic, _patient, _encounter, record);
        using var doc = JsonDocument.Parse(bundleJson);
        var entries = doc.RootElement.GetProperty("entry").EnumerateArray().ToList();

        // 1. Organization
        var org = entries.FirstOrDefault(e => e.GetProperty("resource").GetProperty("resourceType").GetString() == "Organization");
        org.Should().NotBeNull();
        org.GetProperty("resource").GetProperty("id").GetString().Should().Be(_clinic.Id.ToString());

        // 2. Patient
        var pat = entries.FirstOrDefault(e => e.GetProperty("resource").GetProperty("resourceType").GetString() == "Patient");
        pat.Should().NotBeNull();
        pat.GetProperty("resource").GetProperty("id").GetString().Should().Be(_patient.Id.ToString());

        // 3. Encounter
        var enc = entries.FirstOrDefault(e => e.GetProperty("resource").GetProperty("resourceType").GetString() == "Encounter");
        enc.Should().NotBeNull();
        enc.GetProperty("resource").GetProperty("id").GetString().Should().Be(_encounter.Id.ToString());

        // 4. Caries conditions
        var cariesConditions = entries.Where(e =>
            e.GetProperty("resource").GetProperty("resourceType").GetString() == "Condition" &&
            e.GetProperty("resource").GetProperty("code").GetProperty("coding")[0].GetProperty("code").GetString() == "80967001"
        ).ToList();

        cariesConditions.Should().NotBeEmpty();
        foreach (var c in cariesConditions)
        {
            var res = c.GetProperty("resource");
            res.GetProperty("subject").GetProperty("reference").GetString().Should().Be($"urn:uuid:{_patient.Id}");
            res.GetProperty("encounter").GetProperty("reference").GetString().Should().Be($"urn:uuid:{_encounter.Id}");
        }
    }

    [Fact]
    public void BuildBundle_WhenPlanMerelyMirrorsUnchangedStatusStates_EmitsNoServiceRequests()
    {
        // M00 acceptance criterion: the payload serializes `plan` as a full clone of the
        // status chart whenever ANY tooth differs. Tooth 46 below is IDENTICAL in status
        // and plan (existing endo + filling + restoration); only tooth 21 genuinely diverges
        // (planned crown). The mirrored status state of tooth 46 must NOT become a planned
        // procedure — only the tooth 21 divergence may emit a ServiceRequest.
        const string mirroredPlanPayload = """
        {
            "version": "2.22",
            "teeth": {
                "21": { "toothSelection": "tooth-base" },
                "46": {
                    "toothSelection": "tooth-base",
                    "endo": "endo-filling",
                    "restorationType": "filling",
                    "fillingSurfaces": ["occlusal", "distal"],
                    "extractionPlan": true
                }
            },
            "plan": {
                "21": { "toothSelection": "tooth-base", "restorationType": "crown" },
                "46": {
                    "toothSelection": "tooth-base",
                    "endo": "endo-filling",
                    "restorationType": "filling",
                    "fillingSurfaces": ["occlusal", "distal"],
                    "extractionPlan": true
                }
            }
        }
        """;

        var record = OdontogramRecord.Create(_clinic.Id, _patient.Id, _encounter.Id, "2.22", mirroredPlanPayload, _now);

        var bundleJson = FhirBundleBuilder.BuildBundle(_clinic, _patient, _encounter, record);
        using var doc = JsonDocument.Parse(bundleJson);
        var serviceRequests = doc.RootElement.GetProperty("entry").EnumerateArray()
            .Where(e => e.GetProperty("resource").GetProperty("resourceType").GetString() == "ServiceRequest")
            .Select(e => e.GetProperty("resource"))
            .ToList();

        // Exactly one ServiceRequest: the genuine tooth 21 crown divergence.
        serviceRequests.Should().HaveCount(1);
        var only = serviceRequests.Single();
        only.GetProperty("code").GetProperty("coding")[0].GetProperty("code").GetString().Should().Be("281691000");
        only.GetProperty("bodySite")[0].GetProperty("coding")[0].GetProperty("code").GetString().Should().Be("21");
    }

    [Fact]
    public void BuildBundle_WhenPlanChangesValueOrRaisesFlag_EmitsServiceRequestForTheDivergence()
    {
        // Tooth 16: restoration changes filling -> crown (string-axis divergence).
        // Tooth 36: fillingSurfaces gain a surface (set divergence).
        // Tooth 41: extractionPlan raised only in plan (boolean raised divergence).
        // Tooth 11: endo planned while status has none (divergence from absent axis).
        const string divergingPlanPayload = """
        {
            "version": "2.22",
            "teeth": {
                "16": { "toothSelection": "tooth-base", "restorationType": "filling" },
                "36": { "toothSelection": "tooth-base", "fillingSurfaces": ["mesial"] },
                "41": { "toothSelection": "tooth-base" },
                "11": { "toothSelection": "tooth-base" }
            },
            "plan": {
                "16": { "toothSelection": "tooth-base", "restorationType": "crown" },
                "36": { "toothSelection": "tooth-base", "fillingSurfaces": ["mesial", "distal"] },
                "41": { "toothSelection": "tooth-base", "extractionPlan": true },
                "11": { "toothSelection": "tooth-base", "endo": "endo-filling" }
            }
        }
        """;

        var record = OdontogramRecord.Create(_clinic.Id, _patient.Id, _encounter.Id, "2.22", divergingPlanPayload, _now);

        var bundleJson = FhirBundleBuilder.BuildBundle(_clinic, _patient, _encounter, record);
        using var doc = JsonDocument.Parse(bundleJson);
        var requestsByTooth = doc.RootElement.GetProperty("entry").EnumerateArray()
            .Where(e => e.GetProperty("resource").GetProperty("resourceType").GetString() == "ServiceRequest")
            .Select(e => e.GetProperty("resource"))
            .GroupBy(r => r.GetProperty("bodySite")[0].GetProperty("coding")[0].GetProperty("code").GetString())
            .ToDictionary(g => g.Key!, g => g.ToList());

        requestsByTooth.Keys.Should().BeEquivalentTo(new[] { "16", "36", "41", "11" });
        requestsByTooth["16"].Should().ContainSingle(r =>
            r.GetProperty("code").GetProperty("coding")[0].GetProperty("code").GetString() == "281691000");
        requestsByTooth["36"].Should().ContainSingle(r =>
            r.GetProperty("code").GetProperty("coding")[0].GetProperty("code").GetString() == "429994000");
        requestsByTooth["41"].Should().ContainSingle(r =>
            r.GetProperty("code").GetProperty("coding")[0].GetProperty("code").GetString() == "234323000");
        requestsByTooth["11"].Should().ContainSingle(r =>
            r.GetProperty("code").GetProperty("coding")[0].GetProperty("code").GetString() == "234737002");
    }

    [Fact]
    public void BuildBundle_WithStatusAndPlan_SegregatesStatusConditionsAndPlanServiceRequests()
    {
        var record = OdontogramRecord.Create(_clinic.Id, _patient.Id, _encounter.Id, "2.22", ClinicalPayloadFixtures.StatusAndPlanPayload, _now);

        var bundleJson = FhirBundleBuilder.BuildBundle(_clinic, _patient, _encounter, record);
        using var doc = JsonDocument.Parse(bundleJson);
        var entries = doc.RootElement.GetProperty("entry").EnumerateArray().ToList();

        var conditions = entries.Where(e => e.GetProperty("resource").GetProperty("resourceType").GetString() == "Condition").ToList();
        var serviceRequests = entries.Where(e => e.GetProperty("resource").GetProperty("resourceType").GetString() == "ServiceRequest").ToList();

        // Status findings map to Condition (not ServiceRequest)
        conditions.Should().NotBeEmpty();

        // Plan interventions map to ServiceRequest with intent="plan"
        serviceRequests.Should().NotBeEmpty();
        var plan = serviceRequests.First().GetProperty("resource");
        plan.GetProperty("intent").GetString().Should().Be("plan");
        plan.GetProperty("status").GetString().Should().Be("active");
        plan.GetProperty("subject").GetProperty("reference").GetString().Should().Be($"urn:uuid:{_patient.Id}");
        plan.GetProperty("encounter").GetProperty("reference").GetString().Should().Be($"urn:uuid:{_encounter.Id}");
    }

    [Fact]
    public void BuildBundle_WithPrimaryAndMixedDentition_EmitsConditionsForPrimaryTeeth()
    {
        var record = OdontogramRecord.Create(_clinic.Id, _patient.Id, _encounter.Id, "2.22", ClinicalPayloadFixtures.PrimaryAndMixedDentitionPayload, _now);

        var bundleJson = FhirBundleBuilder.BuildBundle(_clinic, _patient, _encounter, record);
        using var doc = JsonDocument.Parse(bundleJson);
        var entries = doc.RootElement.GetProperty("entry").EnumerateArray().ToList();

        // Tooth 51 has caries in PrimaryAndMixedDentitionPayload
        var tooth51Condition = entries.FirstOrDefault(e =>
            e.GetProperty("resource").GetProperty("resourceType").GetString() == "Condition" &&
            e.GetProperty("resource").GetProperty("bodySite")[0].GetProperty("coding")[0].GetProperty("code").GetString() == "51"
        );

        tooth51Condition.Should().NotBeNull();
        tooth51Condition.GetProperty("resource").GetProperty("code").GetProperty("text").GetString().Should().Contain("51");
    }

    [Fact]
    public void BuildBundle_WithMultiplePlannedInterventionsOnSameTooth_EmitsDistinctServiceRequestsWithoutDropping()
    {
        // Finding FHIR-P1-02: Tooth 16 has BOTH planned endo AND planned crown restoration
        const string multiInterventionPayload = """
        {
            "version": "2.22",
            "teeth": {
                "16": {
                    "toothSelection": "tooth-base"
                }
            },
            "plan": {
                "16": {
                    "toothSelection": "tooth-base",
                    "endo": "endo-filling",
                    "restorationType": "crown",
                    "restorationMaterial": "zircon",
                    "fillingSurfaces": ["buccal"]
                }
            }
        }
        """;

        var record = OdontogramRecord.Create(_clinic.Id, _patient.Id, _encounter.Id, "2.22", multiInterventionPayload, _now);

        var bundleJson = FhirBundleBuilder.BuildBundle(_clinic, _patient, _encounter, record);
        using var doc = JsonDocument.Parse(bundleJson);
        var entries = doc.RootElement.GetProperty("entry").EnumerateArray().ToList();

        var serviceRequests = entries
            .Where(e => e.GetProperty("resource").GetProperty("resourceType").GetString() == "ServiceRequest")
            .Select(e => e.GetProperty("resource"))
            .ToList();

        // Must emit all 3 distinct planned interventions on Tooth 16 (none silently dropped by else-if)
        serviceRequests.Should().HaveCount(3);

        // 1. Root canal therapy (234737002)
        var endoReq = serviceRequests.FirstOrDefault(r =>
            r.GetProperty("code").GetProperty("coding")[0].GetProperty("code").GetString() == "234737002");
        endoReq.Should().NotBeNull();
        endoReq!.GetProperty("code").GetProperty("text").GetString().Should().Contain("Planned endodontic treatment on Tooth FDI 16");

        // 2. Crown restoration (281691000)
        var crownReq = serviceRequests.FirstOrDefault(r =>
            r.GetProperty("code").GetProperty("coding")[0].GetProperty("code").GetString() == "281691000");
        crownReq.Should().NotBeNull();
        crownReq!.GetProperty("code").GetProperty("text").GetString().Should().Contain("Planned crown restoration on Tooth FDI 16");

        // 3. Filling restoration (429994000)
        var fillReq = serviceRequests.FirstOrDefault(r =>
            r.GetProperty("code").GetProperty("coding")[0].GetProperty("code").GetString() == "429994000");
        fillReq.Should().NotBeNull();
        fillReq!.GetProperty("code").GetProperty("text").GetString().Should().Contain("Planned dental restoration on Tooth FDI 16");
    }

    [Fact]
    public void BuildBundle_WhenSnapshotJsonIsMalformed_ThrowsInvalidOperationExceptionExplicitly()
    {
        var record = OdontogramRecord.Create(_clinic.Id, _patient.Id, _encounter.Id, "2.22", "{ malformed json broken", _now);

        var act = () => FhirBundleBuilder.BuildBundle(_clinic, _patient, _encounter, record);

        act.Should().Throw<InvalidOperationException>()
            .WithMessage($"*encounter '{_encounter.Id}'*");
    }
}
