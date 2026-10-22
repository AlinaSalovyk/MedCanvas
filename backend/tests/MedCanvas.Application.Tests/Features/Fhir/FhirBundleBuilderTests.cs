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
}
