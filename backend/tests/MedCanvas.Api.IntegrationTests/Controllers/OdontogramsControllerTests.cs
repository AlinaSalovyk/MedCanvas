using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using MedCanvas.Api.Controllers;
using MedCanvas.Api.IntegrationTests.Infrastructure;
using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Application.Features.Odontograms;
using MedCanvas.Domain.Entities;
using MedCanvas.Domain.Enums;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

using MedCanvas.Tests.Data;

namespace MedCanvas.Api.IntegrationTests.Controllers;

public class OdontogramsControllerTests : IClassFixture<MedCanvasApiFactory>, IAsyncLifetime
{
    private readonly MedCanvasApiFactory _factory;

    public OdontogramsControllerTests(MedCanvasApiFactory factory)
    {
        _factory = factory;
    }

    public async Task InitializeAsync()
    {
        await _factory.ResetDatabaseAsync();
    }

    public Task DisposeAsync() => Task.CompletedTask;

    private const string SampleValidPayload = ClinicalPayloadFixtures.CariesAndRestorationsPayload;

    [Fact]
    public async Task SaveOdontogram_InitialSave_PersistsJsonbSnapshotAndReturnsETag()
    {
        // Arrange
        var now = DateTime.UtcNow;
        var clinic = Clinic.Create("Smile Dental Clinic", "SMILE-01", now);
        var user = User.Create("dr.dentist@smiledental.com", "Dr. Dentist", "dummy_hash", now);
        var membership = ClinicMembership.Create(clinic.Id, user.Id, MembershipRole.Clinician, now);
        var patient = Patient.Create(clinic.Id, "Taras", "Shevchenko", null, null, null, null, "MRN-1", null, now);
        var encounter = DentalEncounter.Start(clinic.Id, patient.Id, user.Id, now, "Routine exam", now);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
            db.Clinics.Add(clinic);
            db.Users.Add(user);
            db.ClinicMemberships.Add(membership);
            db.Patients.Add(patient);
            db.DentalEncounters.Add(encounter);
            await db.SaveChangesAsync();
        }

        var client = _factory.CreateAuthenticatedClient(user, clinic.Id, MembershipRole.Clinician);

        var request = new SaveOdontogramRequest(
            SnapshotJson: SampleValidPayload,
            ChangeSummary: "Initial dental baseline examination");

        // Act
        var response = await client.PutAsJsonAsync($"/api/v1/encounters/{encounter.Id}/odontogram", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Headers.ETag.Should().NotBeNull();
        response.Headers.ETag!.Tag.Should().Be("\"1\"");

        var result = await response.Content.ReadFromJsonAsync<OdontogramResponseDto>();
        result.Should().NotBeNull();
        result!.EncounterId.Should().Be(encounter.Id);
        result.ConcurrencyVersion.Should().Be(1);
        result.IsFinalized.Should().BeFalse();
        result.PayloadVersion.Should().Be("2.22");

        // Verify JSON round-trip equivalence with canonical frontend array format
        using var actualDoc = JsonDocument.Parse(result.SnapshotJson);
        actualDoc.RootElement.GetProperty("version").GetString().Should().Be("2.22");
        var cariesArray = actualDoc.RootElement.GetProperty("teeth").GetProperty("11").GetProperty("caries").EnumerateArray().Select(e => e.GetString()).ToList();
        cariesArray.Should().Contain("caries-distal");
        cariesArray.Should().Contain("caries-mesial");
        actualDoc.RootElement.GetProperty("teeth").GetProperty("11").GetProperty("cariesSeverity").GetProperty("distal").GetInt32().Should().Be(3);
    }

    [Fact]
    public async Task SaveOdontogram_ConcurrentEditConflict_Returns412PreconditionFailed()
    {
        // Arrange
        var now = DateTime.UtcNow;
        var clinic = Clinic.Create("Smile Dental Clinic", "SMILE-01", now);
        var user = User.Create("dr.dentist@smiledental.com", "Dr. Dentist", "dummy_hash", now);
        var membership = ClinicMembership.Create(clinic.Id, user.Id, MembershipRole.Clinician, now);
        var patient = Patient.Create(clinic.Id, "Taras", "Shevchenko", null, null, null, null, "MRN-1", null, now);
        var encounter = DentalEncounter.Start(clinic.Id, patient.Id, user.Id, now, "Routine exam", now);
        var record = OdontogramRecord.Create(clinic.Id, patient.Id, encounter.Id, "2.22", SampleValidPayload, now);

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

        // Set stale If-Match header (expected version 99 instead of current 1)
        var httpRequest = new HttpRequestMessage(HttpMethod.Put, $"/api/v1/encounters/{encounter.Id}/odontogram")
        {
            Content = JsonContent.Create(new SaveOdontogramRequest(SnapshotJson: SampleValidPayload, ExpectedVersion: 99))
        };
        httpRequest.Headers.IfMatch.Add(new EntityTagHeaderValue("\"99\""));

        // Act
        var response = await client.SendAsync(httpRequest);

        // Assert - Concurrency conflict must return HTTP 412 Precondition Failed
        response.StatusCode.Should().Be(HttpStatusCode.PreconditionFailed);
    }

    [Fact]
    public async Task SaveOdontogram_MissingPreconditionOnExistingRecord_Returns428PreconditionRequired()
    {
        // Arrange
        var now = DateTime.UtcNow;
        var clinic = Clinic.Create("Smile Dental Clinic", "SMILE-01", now);
        var user = User.Create("dr.dentist@smiledental.com", "Dr. Dentist", "dummy_hash", now);
        var membership = ClinicMembership.Create(clinic.Id, user.Id, MembershipRole.Clinician, now);
        var patient = Patient.Create(clinic.Id, "Taras", "Shevchenko", null, null, null, null, "MRN-1", null, now);
        var encounter = DentalEncounter.Start(clinic.Id, patient.Id, user.Id, now, "Routine exam", now);
        var record = OdontogramRecord.Create(clinic.Id, patient.Id, encounter.Id, "2.22", SampleValidPayload, now);

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

        // Send update without If-Match header and without ExpectedVersion in body
        var httpRequest = new HttpRequestMessage(HttpMethod.Put, $"/api/v1/encounters/{encounter.Id}/odontogram")
        {
            Content = JsonContent.Create(new SaveOdontogramRequest(SnapshotJson: SampleValidPayload, ExpectedVersion: null))
        };

        // Act
        var response = await client.SendAsync(httpRequest);

        // Assert - CON-01 safety invariant: missing precondition on update MUST return 428 Precondition Required
        response.StatusCode.Should().Be((HttpStatusCode)428);
    }

    [Fact]
    public async Task SaveOdontogram_MalformedIfMatchHeader_Returns400BadRequest()
    {
        // Arrange
        var now = DateTime.UtcNow;
        var clinic = Clinic.Create("Smile Dental Clinic", "SMILE-01", now);
        var user = User.Create("dr.dentist@smiledental.com", "Dr. Dentist", "dummy_hash", now);
        var membership = ClinicMembership.Create(clinic.Id, user.Id, MembershipRole.Clinician, now);
        var patient = Patient.Create(clinic.Id, "Taras", "Shevchenko", null, null, null, null, "MRN-1", null, now);
        var encounter = DentalEncounter.Start(clinic.Id, patient.Id, user.Id, now, "Routine exam", now);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
            db.Clinics.Add(clinic);
            db.Users.Add(user);
            db.ClinicMemberships.Add(membership);
            db.Patients.Add(patient);
            db.DentalEncounters.Add(encounter);
            await db.SaveChangesAsync();
        }

        var client = _factory.CreateAuthenticatedClient(user, clinic.Id, MembershipRole.Clinician);

        var httpRequest = new HttpRequestMessage(HttpMethod.Put, $"/api/v1/encounters/{encounter.Id}/odontogram")
        {
            Content = JsonContent.Create(new SaveOdontogramRequest(SnapshotJson: SampleValidPayload))
        };
        httpRequest.Headers.IfMatch.Add(new EntityTagHeaderValue("\"not-an-integer\""));

        // Act
        var response = await client.SendAsync(httpRequest);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task SaveOdontogram_HeaderAndBodyVersionMismatch_Returns400BadRequest()
    {
        // Arrange
        var now = DateTime.UtcNow;
        var clinic = Clinic.Create("Smile Dental Clinic", "SMILE-01", now);
        var user = User.Create("dr.dentist@smiledental.com", "Dr. Dentist", "dummy_hash", now);
        var membership = ClinicMembership.Create(clinic.Id, user.Id, MembershipRole.Clinician, now);
        var patient = Patient.Create(clinic.Id, "Taras", "Shevchenko", null, null, null, null, "MRN-1", null, now);
        var encounter = DentalEncounter.Start(clinic.Id, patient.Id, user.Id, now, "Routine exam", now);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
            db.Clinics.Add(clinic);
            db.Users.Add(user);
            db.ClinicMemberships.Add(membership);
            db.Patients.Add(patient);
            db.DentalEncounters.Add(encounter);
            await db.SaveChangesAsync();
        }

        var client = _factory.CreateAuthenticatedClient(user, clinic.Id, MembershipRole.Clinician);

        var httpRequest = new HttpRequestMessage(HttpMethod.Put, $"/api/v1/encounters/{encounter.Id}/odontogram")
        {
            Content = JsonContent.Create(new SaveOdontogramRequest(SnapshotJson: SampleValidPayload, ExpectedVersion: 2))
        };
        httpRequest.Headers.IfMatch.Add(new EntityTagHeaderValue("\"1\""));

        // Act
        var response = await client.SendAsync(httpRequest);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task SaveOdontogram_WhenUserHasViewerRole_Returns403Forbidden()
    {
        // Arrange - SEC-02: Viewer role cannot mutate clinical odontogram
        var now = DateTime.UtcNow;
        var clinic = Clinic.Create("Smile Dental Clinic", "SMILE-01", now);
        var user = User.Create("viewer@smiledental.com", "Clinical Viewer", "dummy_hash", now);
        var membership = ClinicMembership.Create(clinic.Id, user.Id, MembershipRole.Viewer, now);
        var patient = Patient.Create(clinic.Id, "Taras", "Shevchenko", null, null, null, null, "MRN-1", null, now);
        var encounter = DentalEncounter.Start(clinic.Id, patient.Id, user.Id, now, "Routine exam", now);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
            db.Clinics.Add(clinic);
            db.Users.Add(user);
            db.ClinicMemberships.Add(membership);
            db.Patients.Add(patient);
            db.DentalEncounters.Add(encounter);
            await db.SaveChangesAsync();
        }

        var client = _factory.CreateAuthenticatedClient(user, clinic.Id, MembershipRole.Viewer);

        var request = new SaveOdontogramRequest(SnapshotJson: SampleValidPayload);

        // Act
        var response = await client.PutAsJsonAsync($"/api/v1/encounters/{encounter.Id}/odontogram", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task SaveOdontogram_WhenMembershipIsDeactivatedInDb_Returns403Forbidden()
    {
        // Arrange - AUTH-01: Revoked membership fails closed even with prior JWT
        var now = DateTime.UtcNow;
        var clinic = Clinic.Create("Smile Dental Clinic", "SMILE-01", now);
        var user = User.Create("revoked@smiledental.com", "Dr. Revoked", "dummy_hash", now);
        var membership = ClinicMembership.Create(clinic.Id, user.Id, MembershipRole.Clinician, now);
        membership.Deactivate(now); // Revoked membership
        var patient = Patient.Create(clinic.Id, "Taras", "Shevchenko", null, null, null, null, "MRN-1", null, now);
        var encounter = DentalEncounter.Start(clinic.Id, patient.Id, user.Id, now, "Routine exam", now);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
            db.Clinics.Add(clinic);
            db.Users.Add(user);
            db.ClinicMemberships.Add(membership);
            db.Patients.Add(patient);
            db.DentalEncounters.Add(encounter);
            await db.SaveChangesAsync();
        }

        var client = _factory.CreateAuthenticatedClient(user, clinic.Id, MembershipRole.Clinician);

        var request = new SaveOdontogramRequest(SnapshotJson: SampleValidPayload);

        // Act
        var response = await client.PutAsJsonAsync($"/api/v1/encounters/{encounter.Id}/odontogram", request);

        // Assert - Handler verifies live DB active status and fails closed
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task SaveOdontogram_WhenFinalized_Returns422UnprocessableEntity()
    {
        // Arrange
        var now = DateTime.UtcNow;
        var clinic = Clinic.Create("Smile Dental Clinic", "SMILE-01", now);
        var user = User.Create("dr.dentist@smiledental.com", "Dr. Dentist", "dummy_hash", now);
        var membership = ClinicMembership.Create(clinic.Id, user.Id, MembershipRole.Clinician, now);
        var patient = Patient.Create(clinic.Id, "Taras", "Shevchenko", null, null, null, null, "MRN-1", null, now);
        var encounter = DentalEncounter.Start(clinic.Id, patient.Id, user.Id, now, "Routine exam", now);
        var record = OdontogramRecord.Create(clinic.Id, patient.Id, encounter.Id, "2.22", SampleValidPayload, now);
        record.Finalize(user.Id, 1, now);

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

        var request = new SaveOdontogramRequest(SnapshotJson: SampleValidPayload, ExpectedVersion: record.ConcurrencyVersion);

        // Act - Attempt to modify finalized sealed record
        var response = await client.PutAsJsonAsync($"/api/v1/encounters/{encounter.Id}/odontogram", request);

        // Assert - Finalized record cannot be altered: HTTP 422 Unprocessable Entity
        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task FinalizeOdontogram_WithCorrectVersion_SealsChartAndIncrementsVersion()
    {
        // Arrange
        var now = DateTime.UtcNow;
        var clinic = Clinic.Create("Smile Dental Clinic", "SMILE-01", now);
        var user = User.Create("dr.dentist@smiledental.com", "Dr. Dentist", "dummy_hash", now);
        var membership = ClinicMembership.Create(clinic.Id, user.Id, MembershipRole.Clinician, now);
        var patient = Patient.Create(clinic.Id, "Taras", "Shevchenko", null, null, null, null, "MRN-1", null, now);
        var encounter = DentalEncounter.Start(clinic.Id, patient.Id, user.Id, now, "Routine exam", now);
        var record = OdontogramRecord.Create(clinic.Id, patient.Id, encounter.Id, "2.22", SampleValidPayload, now);

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

        var request = new FinalizeOdontogramRequest(ExpectedVersion: 1);

        // Act
        var response = await client.PostAsJsonAsync($"/api/v1/encounters/{encounter.Id}/odontogram/finalize", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<OdontogramResponseDto>();
        result.Should().NotBeNull();
        result!.IsFinalized.Should().BeTrue();
        result.FinalizedByUserId.Should().Be(user.Id);
        result.FinalizedAtUtc.Should().NotBeNull();
        result.ConcurrencyVersion.Should().Be(2);
        response.Headers.ETag!.Tag.Should().Be("\"2\"");
    }

    [Fact]
    public async Task SaveOdontogram_WithInvalidJsonOrMissingRootTeeth_Returns400BadRequest()
    {
        // Arrange
        var now = DateTime.UtcNow;
        var clinic = Clinic.Create("Smile Dental Clinic", "SMILE-01", now);
        var user = User.Create("dr.dentist@smiledental.com", "Dr. Dentist", "dummy_hash", now);
        var membership = ClinicMembership.Create(clinic.Id, user.Id, MembershipRole.Clinician, now);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
            db.Clinics.Add(clinic);
            db.Users.Add(user);
            db.ClinicMemberships.Add(membership);
            await db.SaveChangesAsync();
        }

        var client = _factory.CreateAuthenticatedClient(user, clinic.Id, MembershipRole.Clinician);

        // Act 1: Invalid JSON syntax
        var resp1 = await client.PutAsJsonAsync($"/api/v1/encounters/{Guid.NewGuid()}/odontogram",
            new SaveOdontogramRequest("not valid json at all"));
        resp1.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        // Act 2: Missing 'teeth' property
        var resp2 = await client.PutAsJsonAsync($"/api/v1/encounters/{Guid.NewGuid()}/odontogram",
            new SaveOdontogramRequest("{\"version\": \"2.22\"}"));
        resp2.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task GetRevisions_ReturnsOrderedRevisionHistory()
    {
        // Arrange
        var now = DateTime.UtcNow;
        var clinic = Clinic.Create("Smile Dental Clinic", "SMILE-01", now);
        var user = User.Create("dr.dentist@smiledental.com", "Dr. Dentist", "dummy_hash", now);
        var membership = ClinicMembership.Create(clinic.Id, user.Id, MembershipRole.Clinician, now);
        var patient = Patient.Create(clinic.Id, "Taras", "Shevchenko", null, null, null, null, "MRN-1", null, now);
        var encounter = DentalEncounter.Start(clinic.Id, patient.Id, user.Id, now, "Routine exam", now);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
            db.Clinics.Add(clinic);
            db.Users.Add(user);
            db.ClinicMemberships.Add(membership);
            db.Patients.Add(patient);
            db.DentalEncounters.Add(encounter);
            await db.SaveChangesAsync();
        }

        var client = _factory.CreateAuthenticatedClient(user, clinic.Id, MembershipRole.Clinician);

        // Mutation 1
        await client.PutAsJsonAsync($"/api/v1/encounters/{encounter.Id}/odontogram",
            new SaveOdontogramRequest(SnapshotJson: SampleValidPayload, ChangeSummary: "Revision 1"));

        // Mutation 2
        await client.PutAsJsonAsync($"/api/v1/encounters/{encounter.Id}/odontogram",
            new SaveOdontogramRequest(SnapshotJson: SampleValidPayload, ExpectedVersion: 1, ChangeSummary: "Revision 2"));

        // Act
        var response = await client.GetAsync($"/api/v1/encounters/{encounter.Id}/odontogram/revisions");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var revisions = await response.Content.ReadFromJsonAsync<List<OdontogramRevisionDto>>();
        revisions.Should().NotBeNull();
        revisions!.Should().HaveCount(2);
        revisions![0].RevisionNumber.Should().Be(2);
        revisions[0].ChangeSummary.Should().Be("Revision 2");
        revisions[1].RevisionNumber.Should().Be(1);
    }
}
