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

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
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
            MedicalAlerts: "Latex allergy");

        // Act
        var response = await client.PutAsJsonAsync($"/api/v1/patients/{patient.Id}", updateCommand);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var updated = await response.Content.ReadFromJsonAsync<PatientDto>();
        updated.Should().NotBeNull();
        updated!.LastName.Should().Be("Bondarenko");
        updated.FullName.Should().Be("Maksym Bondarenko");
        updated.Phone.Should().Be("+380991112233");
        updated.MedicalAlerts.Should().Be("Latex allergy");
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
}
