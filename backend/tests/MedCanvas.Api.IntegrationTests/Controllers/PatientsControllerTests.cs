using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using MedCanvas.Api.IntegrationTests.Infrastructure;
using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Application.Common.Models;
using MedCanvas.Application.Features.Patients;
using MedCanvas.Domain.Entities;
using MedCanvas.Domain.Enums;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace MedCanvas.Api.IntegrationTests.Controllers;

public class PatientsControllerTests : IClassFixture<MedCanvasApiFactory>, IAsyncLifetime
{
    private readonly MedCanvasApiFactory _factory;

    public PatientsControllerTests(MedCanvasApiFactory factory)
    {
        _factory = factory;
    }

    public async Task InitializeAsync()
    {
        await _factory.ResetDatabaseAsync();
    }

    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task CreatePatient_WithValidDemographics_Returns201CreatedAndPersistsInDatabase()
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

        var command = new CreatePatientCommand(
            FirstName: "Olena",
            LastName: "Kovalenko",
            DateOfBirth: new DateOnly(1990, 5, 14),
            Gender: "Female",
            Phone: "+380501234567",
            Email: "olena.kovalenko@example.com",
            ExternalMedicalRecordNumber: "MRN-2026-001",
            MedicalAlerts: "Penicillin allergy");

        // Act
        var response = await client.PostAsJsonAsync("/api/v1/patients", command);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var created = await response.Content.ReadFromJsonAsync<PatientDto>();
        created.Should().NotBeNull();
        created!.Id.Should().NotBeEmpty();
        created.ClinicId.Should().Be(clinic.Id);
        created.FirstName.Should().Be("Olena");
        created.LastName.Should().Be("Kovalenko");
        created.FullName.Should().Be("Olena Kovalenko");
        created.ExternalMedicalRecordNumber.Should().Be("MRN-2026-001");
        created.MedicalAlerts.Should().Be("Penicillin allergy");

        // Verify in DB
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
            var saved = await db.Patients.FindAsync(created.Id);
            saved.Should().NotBeNull();
            saved!.ClinicId.Should().Be(clinic.Id);
        }
    }

    [Fact]
    public async Task CreatePatient_WithDuplicateMrn_Returns400BadRequestDomainRuleViolation()
    {
        // Arrange
        var now = DateTime.UtcNow;
        var clinic = Clinic.Create("Smile Dental Clinic", "SMILE-01", now);
        var user = User.Create("dr.dentist@smiledental.com", "Dr. Dentist", "dummy_hash", now);
        var membership = ClinicMembership.Create(clinic.Id, user.Id, MembershipRole.Clinician, now);
        var existingPatient = Patient.Create(clinic.Id, "Ivan", "Petrenko", null, null, null, null, "MRN-DUPLICATE", null, now);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
            db.Clinics.Add(clinic);
            db.Users.Add(user);
            db.ClinicMemberships.Add(membership);
            db.Patients.Add(existingPatient);
            await db.SaveChangesAsync();
        }

        var client = _factory.CreateAuthenticatedClient(user, clinic.Id, MembershipRole.Clinician);

        var command = new CreatePatientCommand(
            FirstName: "Petro",
            LastName: "Petrenko",
            ExternalMedicalRecordNumber: "MRN-DUPLICATE");

        // Act
        var response = await client.PostAsJsonAsync("/api/v1/patients", command);

        // Assert - Typed conflict returns 409 and never reflects sensitive MRN
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var responseContent = await response.Content.ReadAsStringAsync();
        responseContent.Should().NotContain("MRN-DUPLICATE");
        responseContent.Should().Contain("A patient with this medical record number already exists in this clinic.");
    }

    [Fact]
    public async Task GetPatients_ReturnsOnlyPatientsForAuthenticatedClinic_CrossClinicIsolation()
    {
        // Arrange
        var now = DateTime.UtcNow;
        var clinicA = Clinic.Create("Clinic A", "CLINIC-A", now);
        var clinicB = Clinic.Create("Clinic B", "CLINIC-B", now);

        var userA = User.Create("user.a@clinica.com", "Clinician A", "hash", now);
        var membershipA = ClinicMembership.Create(clinicA.Id, userA.Id, MembershipRole.Clinician, now);

        var patientA1 = Patient.Create(clinicA.Id, "Alice", "Alpha", null, null, null, null, "MRN-A1", null, now);
        var patientA2 = Patient.Create(clinicA.Id, "Arthur", "Adams", null, null, null, null, "MRN-A2", null, now);
        var patientB1 = Patient.Create(clinicB.Id, "Bob", "Bravo", null, null, null, null, "MRN-B1", null, now);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
            db.Clinics.AddRange(clinicA, clinicB);
            db.Users.Add(userA);
            db.ClinicMemberships.Add(membershipA);
            db.Patients.AddRange(patientA1, patientA2, patientB1);
            await db.SaveChangesAsync();
        }

        var clientA = _factory.CreateAuthenticatedClient(userA, clinicA.Id, MembershipRole.Clinician);

        // Act
        var response = await clientA.GetAsync("/api/v1/patients");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResult<PatientDto>>();
        result.Should().NotBeNull();
        result!.TotalCount.Should().Be(2);
        result.Items.Should().HaveCount(2);
        result.Items.Should().OnlyContain(p => p.ClinicId == clinicA.Id);
        result.Items.Should().NotContain(p => p.ClinicId == clinicB.Id);
    }

    [Fact]
    public async Task GetPatientById_WhenBelongsToAnotherClinic_Returns404NotFound()
    {
        // Arrange
        var now = DateTime.UtcNow;
        var clinicA = Clinic.Create("Clinic A", "CLINIC-A", now);
        var clinicB = Clinic.Create("Clinic B", "CLINIC-B", now);

        var userA = User.Create("user.a@clinica.com", "Clinician A", "hash", now);
        var membershipA = ClinicMembership.Create(clinicA.Id, userA.Id, MembershipRole.Clinician, now);

        var patientB = Patient.Create(clinicB.Id, "Secret", "Patient", null, null, null, null, "SECRET-B", null, now);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
            db.Clinics.AddRange(clinicA, clinicB);
            db.Users.Add(userA);
            db.ClinicMemberships.Add(membershipA);
            db.Patients.Add(patientB);
            await db.SaveChangesAsync();
        }

        var clientA = _factory.CreateAuthenticatedClient(userA, clinicA.Id, MembershipRole.Clinician);

        // Act - Clinician from Clinic A attempts to fetch Clinic B's patient by ID
        var response = await clientA.GetAsync($"/api/v1/patients/{patientB.Id}");

        // Assert - IDOR prevented: returns 404 NotFound
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task UpdatePatient_WithValidModifications_UpdatesDemographicsAndReturns200()
    {
        // Arrange
        var now = DateTime.UtcNow;
        var clinic = Clinic.Create("Smile Dental Clinic", "SMILE-01", now);
        var user = User.Create("dr.dentist@smiledental.com", "Dr. Dentist", "dummy_hash", now);
        var membership = ClinicMembership.Create(clinic.Id, user.Id, MembershipRole.Clinician, now);
        var patient = Patient.Create(clinic.Id, "Maksym", "Bondar", null, null, null, null, "MRN-ORIGINAL", "None", now);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
            db.Clinics.Add(clinic);
            db.Users.Add(user);
            db.ClinicMemberships.Add(membership);
            db.Patients.Add(patient);
            await db.SaveChangesAsync();
        }

        var client = _factory.CreateAuthenticatedClient(user, clinic.Id, MembershipRole.Clinician);

        var updateCommand = new UpdatePatientCommand(
            Id: patient.Id,
            FirstName: "Maksym",
            LastName: "Bondarenko",
            Phone: "+380991112233",
            MedicalAlerts: "Latex allergy",
            ExpectedVersion: 1);

        var request = new HttpRequestMessage(HttpMethod.Put, $"/api/v1/patients/{patient.Id}")
        {
            Content = JsonContent.Create(updateCommand)
        };
        request.Headers.Add("If-Match", "\"1\"");

        // Act
        var response = await client.SendAsync(request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Headers.ETag?.Tag.Should().Be("\"2\"");
        var updated = await response.Content.ReadFromJsonAsync<PatientDto>();
        updated.Should().NotBeNull();
        updated!.LastName.Should().Be("Bondarenko");
        updated.FullName.Should().Be("Maksym Bondarenko");
        updated.Phone.Should().Be("+380991112233");
        updated.MedicalAlerts.Should().Be("Latex allergy");
        updated.ConcurrencyVersion.Should().Be(2);
    }

    [Fact]
    public async Task UpdatePatient_WithoutIfMatchHeader_Returns428PreconditionRequired()
    {
        var now = DateTime.UtcNow;
        var clinic = Clinic.Create("Smile Dental Clinic", "SMILE-01", now);
        var user = User.Create("dr.dentist@smiledental.com", "Dr. Dentist", "dummy_hash", now);
        var membership = ClinicMembership.Create(clinic.Id, user.Id, MembershipRole.Clinician, now);
        var patient = Patient.Create(clinic.Id, "Maksym", "Bondar", null, null, null, null, null, null, now);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
            db.Clinics.Add(clinic);
            db.Users.Add(user);
            db.ClinicMemberships.Add(membership);
            db.Patients.Add(patient);
            await db.SaveChangesAsync();
        }

        var client = _factory.CreateAuthenticatedClient(user, clinic.Id, MembershipRole.Clinician);

        var response = await client.PutAsJsonAsync(
            $"/api/v1/patients/{patient.Id}",
            new UpdatePatientCommand(patient.Id, "Maksym", "Bondarenko"));

        response.StatusCode.Should().Be(HttpStatusCode.PreconditionRequired);
    }

    [Fact]
    public async Task UpdatePatient_WithStaleIfMatchVersion_Returns412PreconditionFailed()
    {
        var now = DateTime.UtcNow;
        var clinic = Clinic.Create("Smile Dental Clinic", "SMILE-01", now);
        var user = User.Create("dr.dentist@smiledental.com", "Dr. Dentist", "dummy_hash", now);
        var membership = ClinicMembership.Create(clinic.Id, user.Id, MembershipRole.Clinician, now);
        var patient = Patient.Create(clinic.Id, "Maksym", "Bondar", null, null, null, null, null, null, now);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
            db.Clinics.Add(clinic);
            db.Users.Add(user);
            db.ClinicMemberships.Add(membership);
            db.Patients.Add(patient);
            await db.SaveChangesAsync();
        }

        var client = _factory.CreateAuthenticatedClient(user, clinic.Id, MembershipRole.Clinician);

        var request = new HttpRequestMessage(HttpMethod.Put, $"/api/v1/patients/{patient.Id}")
        {
            Content = JsonContent.Create(new UpdatePatientCommand(patient.Id, "Maksym", "Bondarenko", ExpectedVersion: 5))
        };
        request.Headers.Add("If-Match", "\"5\"");

        var response = await client.SendAsync(request);

        response.StatusCode.Should().Be(HttpStatusCode.PreconditionFailed);
    }

    [Fact]
    public async Task UpdatePatient_WhenRouteIdMismatchesPayloadId_Returns400BadRequest()
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

        var updateCommand = new UpdatePatientCommand(
            Id: Guid.NewGuid(),
            FirstName: "Mismatch",
            LastName: "Test");

        // Act
        var response = await client.PutAsJsonAsync($"/api/v1/patients/{Guid.NewGuid()}", updateCommand);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // ============================================================== M02 additions

    private async Task<(Clinic Clinic, User User, HttpClient Client)> SeedClinicAsync(string identifier)
    {
        var now = DateTime.UtcNow;
        var clinic = Clinic.Create($"Clinic {identifier}", identifier, now);
        var user = User.Create($"doc-{identifier.ToLowerInvariant()}@example.com", "Dr. Dentist", "dummy_hash", now);
        var membership = ClinicMembership.Create(clinic.Id, user.Id, MembershipRole.Clinician, now);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
            db.Clinics.Add(clinic);
            db.Users.Add(user);
            db.ClinicMemberships.Add(membership);
            await db.SaveChangesAsync();
        }

        return (clinic, user, _factory.CreateAuthenticatedClient(user, clinic.Id, MembershipRole.Clinician));
    }

    [Fact]
    public async Task ArchivePatient_RemovesFromDefaultList_KeepsHistory_Readable_AndBlocksNewEncounters()
    {
        var (clinic, user, client) = await SeedClinicAsync("ARCH-1");
        var patient = Patient.Create(clinic.Id, "Olha", "Archived", null, null, null, null, null, null, DateTime.UtcNow);
        var encounter = DentalEncounter.Start(clinic.Id, patient.Id, user.Id, DateTime.UtcNow, "Checkup", DateTime.UtcNow);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
            db.Patients.Add(patient);
            db.DentalEncounters.Add(encounter);
            await db.SaveChangesAsync();
        }

        // Archive
        var archive = await client.PostAsync($"/api/v1/patients/{patient.Id}/archive", content: null);
        archive.StatusCode.Should().Be(HttpStatusCode.OK);
        (await archive.Content.ReadFromJsonAsync<PatientDto>())!.IsActive.Should().BeFalse();

        // Default list excludes; includeArchived shows it
        var defaultList = await client.GetFromJsonAsync<PagedResult<PatientDto>>("/api/v1/patients");
        defaultList!.TotalCount.Should().Be(0);
        var archivedList = await client.GetFromJsonAsync<PagedResult<PatientDto>>("/api/v1/patients?includeArchived=true");
        archivedList!.TotalCount.Should().Be(1);

        // Direct read and history stay available
        var direct = await client.GetAsync($"/api/v1/patients/{patient.Id}");
        direct.StatusCode.Should().Be(HttpStatusCode.OK);
        var history = await client.GetAsync($"/api/v1/patients/{patient.Id}/encounters");
        history.StatusCode.Should().Be(HttpStatusCode.OK);

        // New encounters are rejected while archived (DomainException -> 400)
        var start = await client.PostAsJsonAsync("/api/v1/encounters", new { patientId = patient.Id });
        start.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task RestorePatient_ReturnsPatientToDefaultList()
    {
        var (clinic, _, client) = await SeedClinicAsync("ARCH-2");
        var patient = Patient.Create(clinic.Id, "Ivan", "Restorable", null, null, null, null, null, null, DateTime.UtcNow);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
            db.Patients.Add(patient);
            await db.SaveChangesAsync();
        }

        await client.PostAsync($"/api/v1/patients/{patient.Id}/archive", content: null);
        var restore = await client.PostAsync($"/api/v1/patients/{patient.Id}/restore", content: null);

        restore.StatusCode.Should().Be(HttpStatusCode.OK);
        var list = await client.GetFromJsonAsync<PagedResult<PatientDto>>("/api/v1/patients");
        list!.TotalCount.Should().Be(1);
    }

    [Fact]
    public async Task ArchivePatient_FromForeignClinic_Returns404()
    {
        var (_, _, clientA) = await SeedClinicAsync("ARCH-A");
        var (clinicB, _, clientB) = await SeedClinicAsync("ARCH-B");
        var patientB = Patient.Create(clinicB.Id, "Bo", "Foreign", null, null, null, null, null, null, DateTime.UtcNow);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
            db.Patients.Add(patientB);
            await db.SaveChangesAsync();
        }

        var response = await clientA.PostAsync($"/api/v1/patients/{patientB.Id}/archive", content: null);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        // And the patient was NOT archived by the foreign attempt
        var readB = await clientB.GetAsync($"/api/v1/patients/{patientB.Id}");
        (await readB.Content.ReadFromJsonAsync<PatientDto>())!.IsActive.Should().BeTrue();
    }

    [Fact]
    public async Task ArchivePatient_AsViewer_Returns403()
    {
        var (clinic, _, _) = await SeedClinicAsync("ARCH-3");
        var patient = Patient.Create(clinic.Id, "Vika", "Viewer", null, null, null, null, null, null, DateTime.UtcNow);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
            var viewer = User.Create("viewer@arch3.example.com", "Viewer", "dummy_hash", DateTime.UtcNow);
            db.Users.Add(viewer);
            db.ClinicMemberships.Add(ClinicMembership.Create(clinic.Id, viewer.Id, MembershipRole.Viewer, DateTime.UtcNow));
            db.Patients.Add(patient);
            await db.SaveChangesAsync();

            var viewerClient = _factory.CreateAuthenticatedClient(viewer, clinic.Id, MembershipRole.Viewer);
            var response = await viewerClient.PostAsync($"/api/v1/patients/{patient.Id}/archive", content: null);

            response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        }
    }

    [Fact]
    public async Task GetPatientDuplicates_FindsMatchesByMrnAndByNameDob_WithinOwnClinicOnly()
    {
        var (clinic, _, client) = await SeedClinicAsync("DUP-1");
        var (clinicB, _, clientB) = await SeedClinicAsync("DUP-2");
        var dob = new DateOnly(1985, 7, 7);
        var twinA = Patient.Create(clinic.Id, "Anna", "Twin", dob, null, null, null, "MRN-TWIN", null, DateTime.UtcNow);
        var twinB = Patient.Create(clinicB.Id, "Anna", "Twin", dob, null, null, null, "MRN-TWIN", null, DateTime.UtcNow);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
            db.Patients.AddRange(twinA, twinB);
            await db.SaveChangesAsync();
        }

        // By MRN — only the same-clinic match is visible
        var byMrn = await client.GetFromJsonAsync<List<PatientDto>>($"/api/v1/patients/duplicates?externalMedicalRecordNumber=MRN-TWIN");
        byMrn!.Select(p => p.Id).Should().BeEquivalentTo(new[] { twinA.Id });

        // By name + DOB
        var byName = await client.GetFromJsonAsync<List<PatientDto>>($"/api/v1/patients/duplicates?firstName=Anna&lastName=Twin&dateOfBirth={dob:yyyy-MM-dd}");
        byName!.Select(p => p.Id).Should().BeEquivalentTo(new[] { twinA.Id });

        // Clinic B sees its own twin, not clinic A's
        var fromB = await clientB.GetFromJsonAsync<List<PatientDto>>($"/api/v1/patients/duplicates?firstName=Anna&lastName=Twin&dateOfBirth={dob:yyyy-MM-dd}");
        fromB!.Select(p => p.Id).Should().BeEquivalentTo(new[] { twinB.Id });

        // No criteria -> no scan
        var empty = await client.GetFromJsonAsync<List<PatientDto>>("/api/v1/patients/duplicates");
        empty!.Should().BeEmpty();
    }

    [Fact]
    public async Task GetPatients_SortsByLastNameDescending_WhenRequested()
    {
        var (clinic, _, client) = await SeedClinicAsync("SORT-1");
        var now = DateTime.UtcNow;
        var p1 = Patient.Create(clinic.Id, "Aaa", "Zzz", null, null, null, null, null, null, now);
        var p2 = Patient.Create(clinic.Id, "Bbb", "Aaa", null, null, null, null, null, null, now);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
            db.Patients.AddRange(p1, p2);
            await db.SaveChangesAsync();
        }

        var result = await client.GetFromJsonAsync<PagedResult<PatientDto>>("/api/v1/patients?sortBy=lastname&sortDescending=true");

        result!.Items.Select(p => p.LastName).Should().ContainInOrder("Zzz", "Aaa");
    }

    [Fact]
    public async Task GetPatientById_ReturnsETagHeader()
    {
        var (clinic, _, client) = await SeedClinicAsync("ETAG-1");
        var patient = Patient.Create(clinic.Id, "Eta", "Gova", null, null, null, null, null, null, DateTime.UtcNow);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
            db.Patients.Add(patient);
            await db.SaveChangesAsync();
        }

        var response = await client.GetAsync($"/api/v1/patients/{patient.Id}");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Headers.ETag?.Tag.Should().Be("\"1\"");
    }
}
