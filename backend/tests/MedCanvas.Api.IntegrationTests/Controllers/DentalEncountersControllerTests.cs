using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using MedCanvas.Api.Controllers;
using MedCanvas.Api.IntegrationTests.Infrastructure;
using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Application.Features.Encounters;
using MedCanvas.Domain.Entities;
using MedCanvas.Domain.Enums;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace MedCanvas.Api.IntegrationTests.Controllers;

public class DentalEncountersControllerTests : IClassFixture<MedCanvasApiFactory>, IAsyncLifetime
{
    private readonly MedCanvasApiFactory _factory;

    public DentalEncountersControllerTests(MedCanvasApiFactory factory)
    {
        _factory = factory;
    }

    public async Task InitializeAsync()
    {
        await _factory.ResetDatabaseAsync();
    }

    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task StartEncounter_WithValidPatient_Returns201CreatedAndPersists()
    {
        // Arrange
        var now = DateTime.UtcNow;
        var clinic = Clinic.Create("Smile Dental Clinic", "SMILE-01", now);
        var user = User.Create("dr.dentist@smiledental.com", "Dr. Dentist", "dummy_hash", now);
        var membership = ClinicMembership.Create(clinic.Id, user.Id, MembershipRole.Clinician, now);
        var patient = Patient.Create(clinic.Id, "Taras", "Shevchenko", null, null, null, null, "MRN-TARAS", null, now);

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

        var command = new StartEncounterCommand(
            PatientId: patient.Id,
            ChiefComplaint: "Tooth pain in lower right quadrant");

        // Act
        var response = await client.PostAsJsonAsync("/api/v1/encounters", command);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var created = await response.Content.ReadFromJsonAsync<EncounterDto>();
        created.Should().NotBeNull();
        created!.PatientId.Should().Be(patient.Id);
        created.ClinicId.Should().Be(clinic.Id);
        created.AttendingUserId.Should().Be(user.Id);
        created.ChiefComplaint.Should().Be("Tooth pain in lower right quadrant");
        created.Status.Should().Be("InProgress");

        // Verify in DB
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
            var saved = await db.DentalEncounters.FindAsync(created.Id);
            saved.Should().NotBeNull();
            saved!.Status.Should().Be(EncounterStatus.InProgress);
        }
    }

    [Fact]
    public async Task StartEncounter_WhenPatientBelongsToAnotherClinic_Returns404NotFound()
    {
        // Arrange
        var now = DateTime.UtcNow;
        var clinicA = Clinic.Create("Clinic A", "CLINIC-A", now);
        var clinicB = Clinic.Create("Clinic B", "CLINIC-B", now);

        var userA = User.Create("dr.a@clinica.com", "Dr. A", "hash", now);
        var membershipA = ClinicMembership.Create(clinicA.Id, userA.Id, MembershipRole.Clinician, now);

        var patientB = Patient.Create(clinicB.Id, "Foreign", "Patient", null, null, null, null, "MRN-B", null, now);

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

        var command = new StartEncounterCommand(PatientId: patientB.Id);

        // Act - Clinician from clinic A tries to start encounter for patient from clinic B
        var response = await clientA.PostAsJsonAsync("/api/v1/encounters", command);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task CompleteEncounter_WhenInProgress_Returns200AndUpdatesStatusToCompleted()
    {
        // Arrange
        var now = DateTime.UtcNow;
        var clinic = Clinic.Create("Smile Dental Clinic", "SMILE-01", now);
        var user = User.Create("dr.dentist@smiledental.com", "Dr. Dentist", "dummy_hash", now);
        var membership = ClinicMembership.Create(clinic.Id, user.Id, MembershipRole.Clinician, now);
        var patient = Patient.Create(clinic.Id, "Lesya", "Ukrainka", null, null, null, null, "MRN-LESYA", null, now);
        var encounter = DentalEncounter.Start(clinic.Id, patient.Id, user.Id, now, "Routine checkup", now);

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

        // Act
        var response = await client.PostAsync($"/api/v1/encounters/{encounter.Id}/complete", null);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<EncounterDto>();
        result.Should().NotBeNull();
        result!.Status.Should().Be("Completed");

        // Verify in DB
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
            var saved = await db.DentalEncounters.FindAsync(encounter.Id);
            saved!.Status.Should().Be(EncounterStatus.Completed);
        }
    }

    [Fact]
    public async Task CancelEncounter_WhenInProgress_Returns200AndRecordsCancellationReason()
    {
        // Arrange
        var now = DateTime.UtcNow;
        var clinic = Clinic.Create("Smile Dental Clinic", "SMILE-01", now);
        var user = User.Create("dr.dentist@smiledental.com", "Dr. Dentist", "dummy_hash", now);
        var membership = ClinicMembership.Create(clinic.Id, user.Id, MembershipRole.Clinician, now);
        var patient = Patient.Create(clinic.Id, "Ivan", "Franko", null, null, null, null, "MRN-FRANKO", null, now);
        var encounter = DentalEncounter.Start(clinic.Id, patient.Id, user.Id, now, "Consultation", now);

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

        var request = new CancelEncounterRequest("Patient did not arrive");

        // Act
        var response = await client.PostAsJsonAsync($"/api/v1/encounters/{encounter.Id}/cancel", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<EncounterDto>();
        result.Should().NotBeNull();
        result!.Status.Should().Be("Cancelled");
        result.ClinicalNotes.Should().Contain("Patient did not arrive");
    }

    [Fact]
    public async Task GetByPatient_ReturnsChronologicalEncounterListForClinic()
    {
        // Arrange
        var now = DateTime.UtcNow;
        var clinic = Clinic.Create("Smile Dental Clinic", "SMILE-01", now);
        var user = User.Create("dr.dentist@smiledental.com", "Dr. Dentist", "dummy_hash", now);
        var membership = ClinicMembership.Create(clinic.Id, user.Id, MembershipRole.Clinician, now);
        var patient = Patient.Create(clinic.Id, "Hryhorii", "Skovoroda", null, null, null, null, "MRN-SKOVORODA", null, now);

        var enc1 = DentalEncounter.Start(clinic.Id, patient.Id, user.Id, now.AddDays(-10), "Session 1", now.AddDays(-10));
        var enc2 = DentalEncounter.Start(clinic.Id, patient.Id, user.Id, now.AddDays(-2), "Session 2", now.AddDays(-2));

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
            db.Clinics.Add(clinic);
            db.Users.Add(user);
            db.ClinicMemberships.Add(membership);
            db.Patients.Add(patient);
            db.DentalEncounters.AddRange(enc1, enc2);
            await db.SaveChangesAsync();
        }

        var client = _factory.CreateAuthenticatedClient(user, clinic.Id, MembershipRole.Clinician);

        // Act
        var response = await client.GetAsync($"/api/v1/encounters/by-patient/{patient.Id}");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var list = await response.Content.ReadFromJsonAsync<List<EncounterDto>>();
        list.Should().NotBeNull();
        list!.Should().HaveCount(2);
        list![0].Id.Should().Be(enc2.Id);
        list[1].Id.Should().Be(enc1.Id);
    }
}
