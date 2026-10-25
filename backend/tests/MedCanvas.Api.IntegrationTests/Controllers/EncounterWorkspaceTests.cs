using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using MedCanvas.Api.IntegrationTests.Infrastructure;
using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Domain.Entities;
using MedCanvas.Domain.Enums;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace MedCanvas.Api.IntegrationTests.Controllers;

/// <summary>
/// M04 clinical workspace: appointment-encounter linkage (FR-301) and
/// post-completion write protection (FR-306).
/// </summary>
public class EncounterWorkspaceTests : IClassFixture<MedCanvasApiFactory>, IAsyncLifetime
{
    private readonly MedCanvasApiFactory _factory;

    public EncounterWorkspaceTests(MedCanvasApiFactory factory)
    {
        _factory = factory;
    }

    public async Task InitializeAsync()
    {
        await _factory.ResetDatabaseAsync();
    }

    public Task DisposeAsync() => Task.CompletedTask;

    private sealed record Seed(Clinic Clinic, User Clinician, Patient Patient, ClinicChair Chair, HttpClient Client);

    private async Task<Seed> SeedAsync(string identifier)
    {
        var now = DateTime.UtcNow;
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();

        var clinic = Clinic.Create($"Clinic {identifier}", identifier, now);
        var clinician = User.Create($"doc-{identifier.ToLowerInvariant()}@example.com", "Dr. Workspace", "hash", now);
        var patient = Patient.Create(clinic.Id, "Олег", "Тестовий", null, null, null, null, null, null, now);
        var chair = ClinicChair.Create(clinic.Id, "Chair 1", now);

        db.Clinics.Add(clinic);
        db.Users.Add(clinician);
        db.ClinicMemberships.Add(ClinicMembership.Create(clinic.Id, clinician.Id, MembershipRole.Clinician, now));
        db.Patients.Add(patient);
        db.ClinicChairs.Add(chair);
        await db.SaveChangesAsync();

        return new Seed(clinic, clinician, patient, chair, _factory.CreateAuthenticatedClient(clinician, clinic.Id, MembershipRole.Clinician));
    }

    private Appointment BookSeedAppointment(Seed seed, DateTime startUtc) =>
        Appointment.Create(seed.Clinic.Id, seed.Patient.Id, seed.Clinician.Id, seed.Chair.Id, startUtc, startUtc.AddMinutes(30), "Checkup", null, DateTime.UtcNow);

    [Fact]
    public async Task StartEncounter_FromAppointment_LinksAndPersistsAppointmentId()
    {
        var seed = await SeedAsync("M04-1");
        var appointment = BookSeedAppointment(seed, new DateTime(2026, 11, 2, 9, 0, 0, DateTimeKind.Utc));
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
            db.Appointments.Add(appointment);
            await db.SaveChangesAsync();
        }

        var response = await seed.Client.PostAsJsonAsync("/api/v1/encounters", new
        {
            patientId = seed.Patient.Id,
            appointmentId = appointment.Id
        });

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var dto = await response.Content.ReadFromJsonAsync<JsonElement>();
        dto.GetProperty("appointmentId").GetGuid().Should().Be(appointment.Id);
        dto.GetProperty("status").GetString().Should().Be("InProgress");
    }

    [Fact]
    public async Task StartEncounter_WithForeignPatientAppointment_Returns400()
    {
        var seed = await SeedAsync("M04-2");
        var strangerPatient = Patient.Create(seed.Clinic.Id, "Інший", "Пацієнт", null, null, null, null, null, null, DateTime.UtcNow);
        var wrongPatientAppointment = Appointment.Create(
            seed.Clinic.Id,
            strangerPatient.Id,
            seed.Clinician.Id,
            seed.Chair.Id,
            DateTime.UtcNow.AddHours(1),
            DateTime.UtcNow.AddHours(2),
            "Checkup",
            null,
            DateTime.UtcNow);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
            db.Patients.Add(strangerPatient);
            db.Appointments.Add(wrongPatientAppointment);
            await db.SaveChangesAsync();
        }

        var response = await seed.Client.PostAsJsonAsync("/api/v1/encounters", new
        {
            patientId = seed.Patient.Id,
            appointmentId = wrongPatientAppointment.Id
        });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("different patient");
    }

    [Fact]
    public async Task StartEncounter_WithCancelledAppointment_Returns400()
    {
        var seed = await SeedAsync("M04-3");
        var appointment = BookSeedAppointment(seed, DateTime.UtcNow.AddHours(1));
        appointment.Cancel("Patient cancelled", DateTime.UtcNow);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
            db.Appointments.Add(appointment);
            await db.SaveChangesAsync();
        }

        var response = await seed.Client.PostAsJsonAsync("/api/v1/encounters", new
        {
            patientId = seed.Patient.Id,
            appointmentId = appointment.Id
        });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task SaveOdontogram_AfterEncounterCompletion_IsRejected400()
    {
        var seed = await SeedAsync("M04-4");
        var start = await seed.Client.PostAsJsonAsync("/api/v1/encounters", new { patientId = seed.Patient.Id });
        var encounter = await start.Content.ReadFromJsonAsync<JsonElement>();
        var encounterId = encounter.GetProperty("id").GetGuid();

        // Seed a chart with version 1
        var save = await seed.Client.PutAsJsonAsync($"/api/v1/encounters/{encounterId}/odontogram", new
        {
            snapshotJson = """{"version":"2.22","globals":{},"teeth":{}}""",
            expectedVersion = 1
        });
        save.StatusCode.Should().Be(HttpStatusCode.OK);

        // Complete the encounter
        (await seed.Client.PostAsync($"/api/v1/encounters/{encounterId}/complete", content: null)).StatusCode
            .Should().Be(HttpStatusCode.OK);

        // Clinical writes are sealed (FR-306)
        var edit = await seed.Client.PutAsJsonAsync($"/api/v1/encounters/{encounterId}/odontogram", new
        {
            snapshotJson = """{"version":"2.22","globals":{},"teeth":{"11":{"toothSelection":"implant"}}}""",
            expectedVersion = 1
        });
        edit.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        // With a valid precondition the domain guard still rejects the sealed encounter
        var finalizeRequest = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/encounters/{encounterId}/odontogram/finalize");
        finalizeRequest.Headers.Add("If-Match", "\"1\"");
        var finalize = await seed.Client.SendAsync(finalizeRequest);
        finalize.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await finalize.Content.ReadAsStringAsync()).Should().Contain("no longer be finalized");
    }

    [Fact]
    public async Task Odontogram_RoundTrip_PersistsAcrossReads()
    {
        var seed = await SeedAsync("M04-5");
        var start = await seed.Client.PostAsJsonAsync("/api/v1/encounters", new { patientId = seed.Patient.Id });
        var encounter = await start.Content.ReadFromJsonAsync<JsonElement>();
        var encounterId = encounter.GetProperty("id").GetGuid();

        const string snapshot = """{"version":"2.22","globals":{"wisdomVisible":true},"teeth":{"16":{"toothSelection":"tooth-base","caries":["caries-occlusal"],"cariesSeverity":{"occlusal":3}}}}""";
        var save = await seed.Client.PutAsJsonAsync($"/api/v1/encounters/{encounterId}/odontogram", new
        {
            snapshotJson = snapshot,
            expectedVersion = 1,
            changeSummary = "Initial exam"
        });
        save.StatusCode.Should().Be(HttpStatusCode.OK);

        var read = await seed.Client.GetAsync($"/api/v1/encounters/{encounterId}/odontogram");
        read.StatusCode.Should().Be(HttpStatusCode.OK);
        var record = await read.Content.ReadFromJsonAsync<JsonElement>();
        var stored = JsonSerializer.Deserialize<JsonElement>(record.GetProperty("snapshotJson").GetString()!);
        stored.GetProperty("teeth").GetProperty("16").GetProperty("cariesSeverity").GetProperty("occlusal").GetInt32().Should().Be(3);

        // Revision history is queryable
        var revisions = await seed.Client.GetAsync($"/api/v1/encounters/{encounterId}/odontogram/revisions");
        revisions.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}
