using System.Net;
using System.Text.Json;
using FluentAssertions;
using MedCanvas.Api.IntegrationTests.Infrastructure;
using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Domain.Entities;
using MedCanvas.Domain.Enums;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace MedCanvas.Api.IntegrationTests.Controllers;

public class FhirExportTests : IClassFixture<MedCanvasApiFactory>, IAsyncLifetime
{
    private readonly MedCanvasApiFactory _factory;

    public FhirExportTests(MedCanvasApiFactory factory)
    {
        _factory = factory;
    }

    public async Task InitializeAsync()
    {
        await _factory.ResetDatabaseAsync();
    }

    public Task DisposeAsync() => Task.CompletedTask;

    private const string SampleDentalPayload = """
    {
        "version": "2.22",
        "globals": {},
        "teeth": {
            "11": {
                "caries": {
                    "distal": { "icdas": 3 },
                    "mesial": { "icdas": 2 }
                }
            },
            "26": {
                "caries": {
                    "occlusal": { "icdas": 4 }
                }
            }
        }
    }
    """;

    [Fact]
    public async Task GetFhirBundle_ReturnsValidHl7FhirR4Bundle_WithPatientOrganizationEncounterAndConditions()
    {
        // Arrange
        var now = DateTime.UtcNow;
        var clinic = Clinic.Create("Smile Dental Clinic", "SMILE-01", now);
        var user = User.Create("dr.dentist@smiledental.com", "Dr. Dentist", "dummy_hash", now);
        var membership = ClinicMembership.Create(clinic.Id, user.Id, MembershipRole.Clinician, now);
        var patient = Patient.Create(clinic.Id, "Lesya", "Ukrainka", new DateOnly(1871, 2, 25), "Female", "+380501112233", "lesya@example.com", "MRN-FHIR-1", null, now);
        var encounter = DentalEncounter.Start(clinic.Id, patient.Id, user.Id, now, "Caries treatment plan", now);
        var record = OdontogramRecord.Create(clinic.Id, patient.Id, encounter.Id, "2.22", SampleDentalPayload, now);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
            db.Clinics.Add(clinic);
            db.Users.Add(user);
            db.ClinicMemberships.Add(membership);
            db.Patients.Add(patient);
            db.DentalEncounters.Add(encounter);
            db.OdontogramRecords.Add(record);
            await db.SaveChangesAsync();
        }

        var client = _factory.CreateAuthenticatedClient(user, clinic.Id, MembershipRole.Clinician);

        // Act
        var response = await client.GetAsync($"/api/v1/encounters/{encounter.Id}/fhir");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Content.Headers.ContentType?.MediaType.Should().Be("application/fhir+json");

        var json = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        root.GetProperty("resourceType").GetString().Should().Be("Bundle");
        root.GetProperty("type").GetString().Should().Be("collection");

        var entries = root.GetProperty("entry").EnumerateArray().ToList();
        entries.Should().HaveCountGreaterThanOrEqualTo(4);

        // Verify Organization entry
        var orgEntry = entries.First(e => e.GetProperty("resource").GetProperty("resourceType").GetString() == "Organization");
        orgEntry.GetProperty("resource").GetProperty("name").GetString().Should().Be("Smile Dental Clinic");

        // Verify Patient entry
        var patientEntry = entries.First(e => e.GetProperty("resource").GetProperty("resourceType").GetString() == "Patient");
        patientEntry.GetProperty("resource").GetProperty("gender").GetString().Should().Be("female");

        // Verify Encounter entry
        var encounterEntry = entries.First(e => e.GetProperty("resource").GetProperty("resourceType").GetString() == "Encounter");
        encounterEntry.GetProperty("resource").GetProperty("status").GetString().Should().Be("inprogress");

        // Verify Condition entries for caries
        var conditionEntries = entries.Where(e => e.GetProperty("resource").GetProperty("resourceType").GetString() == "Condition").ToList();
        conditionEntries.Should().HaveCount(3);
    }

    [Fact]
    public async Task GetFhirBundle_WhenEncounterBelongsToDifferentClinic_Returns404NotFound()
    {
        // Arrange
        var now = DateTime.UtcNow;
        var clinicA = Clinic.Create("Clinic A", "CLINIC-A", now);
        var clinicB = Clinic.Create("Clinic B", "CLINIC-B", now);

        var userA = User.Create("dr.a@clinica.com", "Dr. A", "hash", now);
        var membershipA = ClinicMembership.Create(clinicA.Id, userA.Id, MembershipRole.Clinician, now);

        var patientB = Patient.Create(clinicB.Id, "Patient", "B", null, null, null, null, "MRN-B", null, now);
        var encounterB = DentalEncounter.Start(clinicB.Id, patientB.Id, Guid.NewGuid(), now, "Exam", now);
        var recordB = OdontogramRecord.Create(clinicB.Id, patientB.Id, encounterB.Id, "2.22", SampleDentalPayload, now);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
            db.Clinics.AddRange(clinicA, clinicB);
            db.Users.Add(userA);
            db.ClinicMemberships.Add(membershipA);
            db.Patients.Add(patientB);
            db.DentalEncounters.Add(encounterB);
            db.OdontogramRecords.Add(recordB);
            await db.SaveChangesAsync();
        }

        var clientA = _factory.CreateAuthenticatedClient(userA, clinicA.Id, MembershipRole.Clinician);

        // Act - Clinician from clinic A tries to export Clinic B encounter
        var response = await clientA.GetAsync($"/api/v1/encounters/{encounterB.Id}/fhir");

        // Assert - Multi-tenant IDOR defense returns 404
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
