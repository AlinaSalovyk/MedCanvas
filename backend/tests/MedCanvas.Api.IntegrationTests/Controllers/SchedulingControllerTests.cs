using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using MedCanvas.Api.IntegrationTests.Infrastructure;
using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Application.Features.Scheduling;
using MedCanvas.Domain.Entities;
using MedCanvas.Domain.Enums;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace MedCanvas.Api.IntegrationTests.Controllers;

public class SchedulingControllerTests : IClassFixture<MedCanvasApiFactory>, IAsyncLifetime
{
    private readonly MedCanvasApiFactory _factory;

    public SchedulingControllerTests(MedCanvasApiFactory factory)
    {
        _factory = factory;
    }

    public async Task InitializeAsync()
    {
        await _factory.ResetDatabaseAsync();
    }

    public Task DisposeAsync() => Task.CompletedTask;

    private sealed record Seed(
        Clinic Clinic,
        User Admin,
        User Clinician,
        Patient Patient,
        ClinicChair Chair,
        HttpClient Client);

    private async Task<Seed> SeedClinicAsync(string identifier, bool withAvailability = true)
    {
        var now = DateTime.UtcNow;
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();

        var clinic = Clinic.Create($"Clinic {identifier}", identifier, now);
        var admin = User.Create($"admin-{identifier.ToLowerInvariant()}@example.com", "Clinic Admin", "hash", now);
        var clinician = User.Create($"doc-{identifier.ToLowerInvariant()}@example.com", "Dr. Sched", "hash", now);
        var patient = Patient.Create(clinic.Id, "Пацієнт", "Тестовий", new DateOnly(1990, 1, 1), null, null, null, null, null, now);
        var chair = ClinicChair.Create(clinic.Id, "Chair 1", now);

        db.Clinics.Add(clinic);
        db.Users.AddRange(admin, clinician);
        db.ClinicMemberships.AddRange(
            ClinicMembership.Create(clinic.Id, admin.Id, MembershipRole.ClinicAdmin, now),
            ClinicMembership.Create(clinic.Id, clinician.Id, MembershipRole.Clinician, now));
        db.Patients.Add(patient);
        db.ClinicChairs.Add(chair);
        if (withAvailability)
        {
            foreach (var day in Enumerable.Range(1, 7))
                db.ProviderAvailabilities.Add(ProviderAvailability.Create(clinic.Id, clinician.Id, day, new TimeOnly(8, 0), new TimeOnly(18, 0), now));
        }
        await db.SaveChangesAsync();

        return new Seed(clinic, admin, clinician, patient, chair, _factory.CreateAuthenticatedClient(admin, clinic.Id, MembershipRole.ClinicAdmin));
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Create_WithoutWorkingWindow_RejectsEvenWithBooleanWorkingException(bool addException)
    {
        var seed = await SeedClinicAsync("NO-SCHEDULE", withAvailability: false);
        var start = new DateTime(2026, 11, 2, 9, 0, 0, DateTimeKind.Utc);
        if (addException)
        {
            using var scope = _factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
            db.ProviderAvailabilityExceptions.Add(ProviderAvailabilityException.Create(seed.Clinic.Id, seed.Clinician.Id,
                new DateOnly(2026, 11, 2), true, DateTime.UtcNow));
            await db.SaveChangesAsync();
        }
        var response = await seed.Client.PostAsJsonAsync("/api/v1/appointments", CreateBody(seed, start, start.AddMinutes(30)));
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    private static object CreateBody(Seed seed, DateTime startUtc, DateTime endUtc, string reason = "Checkup") => new
    {
        patientId = seed.Patient.Id,
        clinicianUserId = seed.Clinician.Id,
        chairId = seed.Chair.Id,
        startAtUtc = startUtc,
        endAtUtc = endUtc,
        reasonForVisit = reason
    };

    [Theory]
    [InlineData("2026-03-29T00:45:00Z", "2026-03-29T01:15:00Z", false)]
    [InlineData("2026-10-25T00:15:00Z", "2026-10-25T00:45:00Z", false)]
    [InlineData("2026-03-29T07:00:00Z", "2026-03-29T07:30:00Z", true)]
    [InlineData("2026-10-25T07:00:00Z", "2026-10-25T07:30:00Z", true)]
    public async Task Availability_DaylightSavingTransitions_UsesExplicitUnambiguousIntervals(string from, string to, bool accepted)
    {
        var seed = await SeedClinicAsync("DST");
        var start = DateTime.Parse(from, null, System.Globalization.DateTimeStyles.AdjustToUniversal | System.Globalization.DateTimeStyles.AssumeUniversal);
        var end = DateTime.Parse(to, null, System.Globalization.DateTimeStyles.AdjustToUniversal | System.Globalization.DateTimeStyles.AssumeUniversal);
        var response = await seed.Client.PostAsJsonAsync("/api/v1/appointments", CreateBody(seed, start, end));
        response.StatusCode.Should().Be(accepted ? HttpStatusCode.Created : HttpStatusCode.BadRequest);
        if (!accepted) (await response.Content.ReadAsStringAsync()).Should().Contain("unambiguous");
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task AvailabilityException_UnauthorizedTarget_HasNoPersistedSideEffects(bool foreign)
    {
        var seed = await SeedClinicAsync("EXCEPTION-AUTH");
        var target = foreign ? (await SeedClinicAsync("EXCEPTION-FOREIGN")).Clinician.Id : seed.Admin.Id;
        var client = foreign ? seed.Client : _factory.CreateAuthenticatedClient(seed.Clinician, seed.Clinic.Id, MembershipRole.Clinician);
        var response = await client.PostAsJsonAsync($"/api/v1/availability/{target}/exceptions",
            new { date = "2026-11-02", isWorkingDay = false });
        response.StatusCode.Should().Be(foreign ? HttpStatusCode.NotFound : HttpStatusCode.Forbidden);
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
        db.ProviderAvailabilityExceptions.Should().BeEmpty();
    }

    [Theory]
    [InlineData(9, true)]
    [InlineData(11, false)]
    [InlineData(17, false)]
    public async Task WorkingDayException_PreservesWeeklyWindowAndBreaks(int utcHour, bool accepted)
    {
        var seed = await SeedClinicAsync("WORKING-EXCEPTION", withAvailability: false);
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
            var window = ProviderAvailability.Create(seed.Clinic.Id, seed.Clinician.Id, 1, new TimeOnly(8, 0), new TimeOnly(18, 0), DateTime.UtcNow);
            db.ProviderAvailabilities.Add(window);
            db.ProviderAvailabilityBreaks.Add(ProviderAvailabilityBreak.Create(window.Id, new TimeOnly(13, 0), new TimeOnly(14, 0), DateTime.UtcNow));
            db.ProviderAvailabilityExceptions.Add(ProviderAvailabilityException.Create(seed.Clinic.Id, seed.Clinician.Id, new DateOnly(2026, 11, 2), true, DateTime.UtcNow));
            await db.SaveChangesAsync();
        }
        var start = new DateTime(2026, 11, 2, utcHour, 0, 0, DateTimeKind.Utc);
        var response = await seed.Client.PostAsJsonAsync("/api/v1/appointments", CreateBody(seed, start, start.AddMinutes(30)));
        response.StatusCode.Should().Be(accepted ? HttpStatusCode.Created : HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Reschedule_IntoDayWithoutWorkingWindow_RejectsAndPreservesOriginal()
    {
        var seed = await SeedClinicAsync("RESCHED-UNAVAILABLE", withAvailability: false);
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
            db.ProviderAvailabilities.Add(ProviderAvailability.Create(seed.Clinic.Id, seed.Clinician.Id, 1,
                new TimeOnly(8, 0), new TimeOnly(18, 0), DateTime.UtcNow));
            await db.SaveChangesAsync();
        }
        var start = new DateTime(2026, 11, 2, 9, 0, 0, DateTimeKind.Utc);
        var created = await seed.Client.PostAsJsonAsync("/api/v1/appointments", CreateBody(seed, start, start.AddMinutes(30)));
        created.StatusCode.Should().Be(HttpStatusCode.Created);
        var dto = (await created.Content.ReadFromJsonAsync<AppointmentDto>())!;
        using var request = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/appointments/{dto.Id}/reschedule")
        {
            Content = JsonContent.Create(new { newStartAtUtc = start.AddDays(1), newEndAtUtc = start.AddDays(1).AddMinutes(30), expectedVersion = 1 })
        };
        request.Headers.Add("If-Match", "\"1\"");
        (await seed.Client.SendAsync(request)).StatusCode.Should().Be(HttpStatusCode.BadRequest);
        using var check = _factory.Services.CreateScope();
        var dbCheck = check.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
        (await dbCheck.Appointments.FindAsync(dto.Id))!.StartAtUtc.Should().Be(start);
    }

    [Fact]
    public async Task Create_WithFreeSlot_Returns201WithETag()
    {
        var seed = await SeedClinicAsync("SCH-1");
        var start = new DateTime(2026, 11, 2, 9, 0, 0, DateTimeKind.Utc); // Monday

        var response = await seed.Client.PostAsJsonAsync("/api/v1/appointments", CreateBody(seed, start, start.AddMinutes(30)));

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        response.Headers.ETag?.Tag.Should().Be("\"1\"");
        var dto = await response.Content.ReadFromJsonAsync<AppointmentDto>();
        dto!.Status.Should().Be(AppointmentStatus.Scheduled);
        dto.PatientFullName.Should().Be("Пацієнт Тестовий");
        dto.ChairName.Should().Be("Chair 1");
    }

    [Fact]
    public async Task Create_TwoSequentialOverlappingBookingsSameClinician_SecondGets409()
    {
        var seed = await SeedClinicAsync("SCH-2");
        var start = new DateTime(2026, 11, 2, 9, 0, 0, DateTimeKind.Utc);

        var first = await seed.Client.PostAsJsonAsync("/api/v1/appointments", CreateBody(seed, start, start.AddMinutes(30)));
        var second = await seed.Client.PostAsJsonAsync("/api/v1/appointments", CreateBody(seed, start.AddMinutes(15), start.AddMinutes(45)));

        first.StatusCode.Should().Be(HttpStatusCode.Created);
        second.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Create_ConcurrentDoubleBooking_ExactlyOneWins()
    {
        var seed = await SeedClinicAsync("SCH-3");
        var start = new DateTime(2026, 11, 2, 10, 0, 0, DateTimeKind.Utc);
        var body = CreateBody(seed, start, start.AddMinutes(30));

        // Two racing requests for the same slot: the DB exclusion constraint must
        // guarantee exactly one winner even though both pre-checks see a free slot.
        var task1 = seed.Client.PostAsJsonAsync("/api/v1/appointments", body);
        var task2 = seed.Client.PostAsJsonAsync("/api/v1/appointments", body);
        var results = await Task.WhenAll(task1, task2);

        var codes = results.Select(r => r.StatusCode).OrderBy(c => (int)c).ToList();
        codes.Should().ContainSingle(c => c == HttpStatusCode.Created);
        codes.Should().ContainSingle(c => c == HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Create_OverlappingSameChairDifferentClinician_Returns409()
    {
        var seed = await SeedClinicAsync("SCH-4");
        var now = DateTime.UtcNow;
        var otherClinician = User.Create("doc2-sch4@example.com", "Dr. Second", "hash", now);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
            db.Users.Add(otherClinician);
            db.ClinicMemberships.Add(ClinicMembership.Create(seed.Clinic.Id, otherClinician.Id, MembershipRole.Clinician, now));
            db.ProviderAvailabilities.Add(ProviderAvailability.Create(seed.Clinic.Id, otherClinician.Id, 1, new TimeOnly(8, 0), new TimeOnly(18, 0), now));
            await db.SaveChangesAsync();
        }

        var start = new DateTime(2026, 11, 2, 9, 0, 0, DateTimeKind.Utc);
        var first = await seed.Client.PostAsJsonAsync("/api/v1/appointments", CreateBody(seed, start, start.AddMinutes(30)));
        var second = await seed.Client.PostAsJsonAsync("/api/v1/appointments", new
        {
            patientId = (object)seed.Patient.Id,
            clinicianUserId = otherClinician.Id,
            chairId = seed.Chair.Id,
            startAtUtc = start.AddMinutes(10),
            endAtUtc = start.AddMinutes(40),
            reasonForVisit = "Same chair overlap"
        });

        first.StatusCode.Should().Be(HttpStatusCode.Created);
        second.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Create_ForForeignClinicPatient_Returns404()
    {
        var seedA = await SeedClinicAsync("SCH-A");
        var seedB = await SeedClinicAsync("SCH-B");

        var start = new DateTime(2026, 11, 2, 9, 0, 0, DateTimeKind.Utc);
        var response = await seedA.Client.PostAsJsonAsync("/api/v1/appointments", new
        {
            patientId = seedB.Patient.Id, // clinic B patient in clinic A calendar
            clinicianUserId = seedA.Clinician.Id,
            chairId = seedA.Chair.Id,
            startAtUtc = start,
            endAtUtc = start.AddMinutes(30),
            reasonForVisit = "Cross-tenant attempt"
        });

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Lifecycle_ConfirmArriveComplete_TransitionsLegally()
    {
        var seed = await SeedClinicAsync("SCH-5");
        var start = new DateTime(2026, 11, 2, 9, 0, 0, DateTimeKind.Utc);
        var created = await seed.Client.PostAsJsonAsync("/api/v1/appointments", CreateBody(seed, start, start.AddMinutes(30)));
        var dto = await created.Content.ReadFromJsonAsync<AppointmentDto>();

        (await seed.Client.PostAsync($"/api/v1/appointments/{dto!.Id}/confirm", content: null)).StatusCode.Should().Be(HttpStatusCode.OK);
        (await seed.Client.PostAsync($"/api/v1/appointments/{dto.Id}/arrive", content: null)).StatusCode.Should().Be(HttpStatusCode.OK);
        var completed = await seed.Client.PostAsync($"/api/v1/appointments/{dto.Id}/complete", content: null);
        completed.StatusCode.Should().Be(HttpStatusCode.OK);
        (await completed.Content.ReadFromJsonAsync<AppointmentDto>())!.Status.Should().Be(AppointmentStatus.Completed);

        // Terminal state is immutable
        (await seed.Client.PostAsync($"/api/v1/appointments/{dto.Id}/confirm", content: null)).StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Cancel_WithReason_ReleasesSlotForRebooking()
    {
        var seed = await SeedClinicAsync("SCH-6");
        var start = new DateTime(2026, 11, 2, 9, 0, 0, DateTimeKind.Utc);
        var created = await seed.Client.PostAsJsonAsync("/api/v1/appointments", CreateBody(seed, start, start.AddMinutes(30)));
        var dto = await created.Content.ReadFromJsonAsync<AppointmentDto>();

        var cancel = await seed.Client.PostAsJsonAsync($"/api/v1/appointments/{dto!.Id}/cancel", new { reason = "Patient asked to move" });
        cancel.StatusCode.Should().Be(HttpStatusCode.OK);
        (await cancel.Content.ReadFromJsonAsync<AppointmentDto>())!.CancellationReason.Should().Be("Patient asked to move");

        // The cancelled slot is reusable
        var rebook = await seed.Client.PostAsJsonAsync("/api/v1/appointments", CreateBody(seed, start, start.AddMinutes(30)));
        rebook.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task Cancel_WithoutReason_Returns400()
    {
        var seed = await SeedClinicAsync("SCH-7");
        var start = new DateTime(2026, 11, 2, 9, 0, 0, DateTimeKind.Utc);
        var created = await seed.Client.PostAsJsonAsync("/api/v1/appointments", CreateBody(seed, start, start.AddMinutes(30)));
        var dto = await created.Content.ReadFromJsonAsync<AppointmentDto>();

        var response = await seed.Client.PostAsJsonAsync($"/api/v1/appointments/{dto!.Id}/cancel", new { reason = "" });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Reschedule_RequiresIfMatchAndRejectsStaleVersions()
    {
        var seed = await SeedClinicAsync("SCH-8");
        var start = new DateTime(2026, 11, 2, 9, 0, 0, DateTimeKind.Utc);
        var created = await seed.Client.PostAsJsonAsync("/api/v1/appointments", CreateBody(seed, start, start.AddMinutes(30)));
        var dto = await created.Content.ReadFromJsonAsync<AppointmentDto>();
        var newStart = start.AddDays(1);

        var body = new { newStartAtUtc = newStart, newEndAtUtc = newStart.AddMinutes(45) };

        // Missing If-Match -> 428
        var noPrecondition = await seed.Client.PostAsJsonAsync($"/api/v1/appointments/{dto!.Id}/reschedule", body);
        noPrecondition.StatusCode.Should().Be(HttpStatusCode.PreconditionRequired);

        // Stale If-Match -> 412
        var stale = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/appointments/{dto.Id}/reschedule")
        {
            Content = JsonContent.Create(new { newStartAtUtc = newStart, newEndAtUtc = newStart.AddMinutes(45), expectedVersion = 7 })
        };
        stale.Headers.Add("If-Match", "\"7\"");
        var staleResponse = await seed.Client.SendAsync(stale);
        staleResponse.StatusCode.Should().Be(HttpStatusCode.PreconditionFailed);

        // Correct If-Match -> 200 + version bump + new time
        var ok = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/appointments/{dto.Id}/reschedule")
        {
            Content = JsonContent.Create(new { newStartAtUtc = newStart, newEndAtUtc = newStart.AddMinutes(45), expectedVersion = 1 })
        };
        ok.Headers.Add("If-Match", "\"1\"");
        var okResponse = await seed.Client.SendAsync(ok);
        okResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var moved = await okResponse.Content.ReadFromJsonAsync<AppointmentDto>();
        moved!.StartAtUtc.Should().Be(newStart);
        moved.ConcurrencyVersion.Should().Be(2);
    }

    [Fact]
    public async Task Availability_BlocksOutsideHoursBreaksAndDaysOff()
    {
        var seed = await SeedClinicAsync("SCH-9", withAvailability: false);
        var now = DateTime.UtcNow;

        // Weekly template: Monday 08:00–18:00 local with a 13:00–14:00 lunch.
        // Clinic TZ default Europe/Kyiv: Monday 2026-11-02 08:00 local = 06:00 UTC.
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
            var window = ProviderAvailability.Create(seed.Clinic.Id, seed.Clinician.Id, 1, new TimeOnly(8, 0), new TimeOnly(18, 0), now);
            db.ProviderAvailabilities.Add(window);
            db.ProviderAvailabilityBreaks.Add(ProviderAvailabilityBreak.Create(window.Id, new TimeOnly(13, 0), new TimeOnly(14, 0), now));
            await db.SaveChangesAsync();
        }

        // Inside working hours: OK (08:30–09:00 local)
        var ok = await seed.Client.PostAsJsonAsync("/api/v1/appointments", CreateBody(
            seed,
            new DateTime(2026, 11, 2, 6, 30, 0, DateTimeKind.Utc),
            new DateTime(2026, 11, 2, 7, 0, 0, DateTimeKind.Utc)));
        ok.StatusCode.Should().Be(HttpStatusCode.Created);

        // Inside lunch break: rejected (13:30–13:45 local = 11:30Z)
        var lunch = await seed.Client.PostAsJsonAsync("/api/v1/appointments", CreateBody(
            seed,
            new DateTime(2026, 11, 2, 11, 30, 0, DateTimeKind.Utc),
            new DateTime(2026, 11, 2, 11, 45, 0, DateTimeKind.Utc)));
        lunch.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        // Outside hours: rejected (18:30 local = 16:30Z)
        var late = await seed.Client.PostAsJsonAsync("/api/v1/appointments", CreateBody(
            seed,
            new DateTime(2026, 11, 2, 16, 30, 0, DateTimeKind.Utc),
            new DateTime(2026, 11, 2, 17, 0, 0, DateTimeKind.Utc)));
        late.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        // Tuesday (no template): rejected (Nov 3 09:00 local = 07:00Z)
        var tuesday = await seed.Client.PostAsJsonAsync("/api/v1/appointments", CreateBody(
            seed,
            new DateTime(2026, 11, 3, 7, 0, 0, DateTimeKind.Utc),
            new DateTime(2026, 11, 3, 7, 30, 0, DateTimeKind.Utc)));
        tuesday.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        // Dated exception (day off) blocks Monday bookings
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
            db.ProviderAvailabilityExceptions.Add(ProviderAvailabilityException.Create(seed.Clinic.Id, seed.Clinician.Id, new DateOnly(2026, 11, 9), false, now));
            await db.SaveChangesAsync();
        }

        var dayOff = await seed.Client.PostAsJsonAsync("/api/v1/appointments", CreateBody(
            seed,
            new DateTime(2026, 11, 9, 6, 30, 0, DateTimeKind.Utc),
            new DateTime(2026, 11, 9, 7, 0, 0, DateTimeKind.Utc)));
        dayOff.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Calendar_WindowReturnsOnlyOwnClinicAppointments_WithFilters()
    {
        var seedA = await SeedClinicAsync("CAL-A");
        var seedB = await SeedClinicAsync("CAL-B");
        var start = new DateTime(2026, 11, 2, 9, 0, 0, DateTimeKind.Utc);

        await seedA.Client.PostAsJsonAsync("/api/v1/appointments", CreateBody(seedA, start, start.AddMinutes(30)));
        await seedB.Client.PostAsJsonAsync("/api/v1/appointments", CreateBody(seedB, start, start.AddMinutes(30)));

        var from = new DateTime(2026, 11, 1, 0, 0, 0, DateTimeKind.Utc);
        var to = new DateTime(2026, 11, 8, 0, 0, 0, DateTimeKind.Utc);

        var listA = await seedA.Client.GetFromJsonAsync<List<AppointmentDto>>(
            $"/api/v1/appointments?fromUtc={from:O}&toUtc={to:O}");
        listA!.Should().HaveCount(1);
        listA[0].ClinicId.Should().Be(seedA.Clinic.Id);

        var filtered = await seedA.Client.GetFromJsonAsync<List<AppointmentDto>>(
            $"/api/v1/appointments?fromUtc={from:O}&toUtc={to:O}&clinicianId={seedB.Clinician.Id}");
        filtered!.Should().BeEmpty();
    }

    [Fact]
    public async Task Create_AsViewer_Returns403()
    {
        var seed = await SeedClinicAsync("SCH-10");
        var now = DateTime.UtcNow;
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
        var viewer = User.Create("viewer@sch10.example.com", "Viewer", "hash", now);
        db.Users.Add(viewer);
        db.ClinicMemberships.Add(ClinicMembership.Create(seed.Clinic.Id, viewer.Id, MembershipRole.Viewer, now));
        await db.SaveChangesAsync();

        var viewerClient = _factory.CreateAuthenticatedClient(viewer, seed.Clinic.Id, MembershipRole.Viewer);
        var start = new DateTime(2026, 11, 2, 9, 0, 0, DateTimeKind.Utc);
        var response = await viewerClient.PostAsJsonAsync("/api/v1/appointments", CreateBody(seed, start, start.AddMinutes(30)));

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Chairs_CreateRenameDeactivate_WithDuplicateName409()
    {
        var seed = await SeedClinicAsync("SCH-11");

        var created = await seed.Client.PostAsJsonAsync("/api/v1/chairs", new { name = "Chair 2" });
        created.StatusCode.Should().Be(HttpStatusCode.Created);
        var chair = await created.Content.ReadFromJsonAsync<ChairDto>();

        var duplicate = await seed.Client.PostAsJsonAsync("/api/v1/chairs", new { name = "Chair 2" });
        duplicate.StatusCode.Should().Be(HttpStatusCode.Conflict);

        var renamed = await seed.Client.PutAsJsonAsync($"/api/v1/chairs/{chair!.Id}/name", new { name = "Chair 2 Renamed" });
        renamed.StatusCode.Should().Be(HttpStatusCode.OK);

        var deactivated = await seed.Client.PostAsync($"/api/v1/chairs/{chair.Id}/deactivate", content: null);
        deactivated.StatusCode.Should().Be(HttpStatusCode.OK);
        (await deactivated.Content.ReadFromJsonAsync<ChairDto>())!.IsActive.Should().BeFalse();
    }
}
