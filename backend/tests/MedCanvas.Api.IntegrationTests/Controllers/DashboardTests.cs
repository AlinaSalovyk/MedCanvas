using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using MedCanvas.Api.IntegrationTests.Infrastructure;
using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Domain.Entities;
using MedCanvas.Domain.Enums;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace MedCanvas.Api.IntegrationTests.Controllers;

/// <summary>FR-704/705: dashboard counters come from real tenant data, role-scoped.</summary>
public class DashboardTests : IClassFixture<MedCanvasApiFactory>, IAsyncLifetime
{
    private readonly MedCanvasApiFactory _factory;

    public DashboardTests(MedCanvasApiFactory factory)
    {
        _factory = factory;
    }

    public async Task InitializeAsync()
    {
        await _factory.ResetDatabaseAsync();
    }

    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task Dashboard_ReturnsRealCounters_ForClinicScope()
    {
        var now = DateTime.UtcNow;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();

            var clinic = Clinic.Create("Dash Clinic", "DASH-1", now);
            var admin = User.Create("admin-dash@example.com", "Admin", "hash", now);
            var patient = Patient.Create(clinic.Id, "Пацієнт", "Даш", null, null, null, null, null, null, now);
            var chair = ClinicChair.Create(clinic.Id, "Chair 1", now);

            // Today: one confirmed (waiting), one completed
            var todayStart = DateTime.UtcNow.Date;
            var confirmed = Appointment.Create(clinic.Id, patient.Id, admin.Id, chair.Id, now.AddMinutes(30), now.AddMinutes(60), "Waiting slot", null, now);
            confirmed.Confirm(now);
            var completed = Appointment.Create(clinic.Id, patient.Id, admin.Id, chair.Id, todayStart.AddHours(1), todayStart.AddHours(2), "Done slot", null, now);
            completed.Confirm(now);
            completed.MarkArrived(now);
            completed.Complete(now);
            // Next week: upcoming
            var upcoming = Appointment.Create(clinic.Id, patient.Id, admin.Id, chair.Id, now.AddDays(3), now.AddDays(3).AddMinutes(30), "Future", null, now);

            var encounter = DentalEncounter.Start(clinic.Id, patient.Id, admin.Id, now, null, now);

            db.Clinics.Add(clinic);
            db.Users.Add(admin);
            db.ClinicMemberships.Add(ClinicMembership.Create(clinic.Id, admin.Id, MembershipRole.ClinicAdmin, now));
            db.Patients.Add(patient);
            db.ClinicChairs.Add(chair);
            db.Appointments.AddRange(confirmed, completed, upcoming);
            db.DentalEncounters.Add(encounter);
            await db.SaveChangesAsync();

            var client = _factory.CreateAuthenticatedClient(admin, clinic.Id, MembershipRole.ClinicAdmin);
            var response = await client.GetAsync("/api/v1/dashboard");
            response.StatusCode.Should().Be(HttpStatusCode.OK);
            var dash = await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
            dash.GetProperty("todaysAppointments").GetInt32().Should().Be(2);
            dash.GetProperty("waitingPatients").GetInt32().Should().Be(1);
            dash.GetProperty("completedToday").GetInt32().Should().Be(1);
            dash.GetProperty("upcomingAppointments7Days").GetInt32().Should().Be(1);
            dash.GetProperty("inProgressEncounters").GetInt32().Should().Be(1);
            dash.GetProperty("financeIsDemo").GetBoolean().Should().BeTrue();

            // Foreign clinic sees zeros, not this clinic's numbers
            var clinicB = Clinic.Create("Dash B", "DASH-2", now);
            var adminB = User.Create("admin-dashb@example.com", "Admin B", "hash", now);
            db.Clinics.Add(clinicB);
            db.Users.Add(adminB);
            db.ClinicMemberships.Add(ClinicMembership.Create(clinicB.Id, adminB.Id, MembershipRole.ClinicAdmin, now));
            await db.SaveChangesAsync();

            var clientB = _factory.CreateAuthenticatedClient(adminB, clinicB.Id, MembershipRole.ClinicAdmin);
            var responseB = await clientB.GetAsync("/api/v1/dashboard");
            responseB.StatusCode.Should().Be(HttpStatusCode.OK);
            var dashB = await responseB.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
            dashB.GetProperty("todaysAppointments").GetInt32().Should().Be(0);
        }
    }
}
