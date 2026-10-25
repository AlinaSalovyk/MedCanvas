using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using MedCanvas.Api.IntegrationTests.Infrastructure;
using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Application.Features.TreatmentPlanning;
using MedCanvas.Domain.Entities;
using MedCanvas.Domain.Enums;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace MedCanvas.Api.IntegrationTests.Controllers;

public class TreatmentPlanningTests : IClassFixture<MedCanvasApiFactory>, IAsyncLifetime
{
    private readonly MedCanvasApiFactory _factory;

    public TreatmentPlanningTests(MedCanvasApiFactory factory)
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
        User Clinician,
        Patient Patient,
        DentalEncounter Encounter,
        HttpClient Client);

    private async Task<Seed> SeedAsync(string identifier)
    {
        var now = DateTime.UtcNow;
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();

        var clinic = Clinic.Create($"Clinic {identifier}", identifier, now);
        var admin = User.Create($"admin-{identifier.ToLowerInvariant()}@example.com", "Admin Plan", "hash", now);
        var clinician = User.Create($"doc-{identifier.ToLowerInvariant()}@example.com", "Dr. Plan", "hash", now);
        var patient = Patient.Create(clinic.Id, "Пацієнт", "Плановий", null, null, null, null, null, null, now);
        var encounter = DentalEncounter.Start(clinic.Id, patient.Id, clinician.Id, now, "Plan checkup", now);

        db.Clinics.Add(clinic);
        db.Users.AddRange(admin, clinician);
        db.ClinicMemberships.Add(ClinicMembership.Create(clinic.Id, admin.Id, MembershipRole.ClinicAdmin, now));
        db.ClinicMemberships.Add(ClinicMembership.Create(clinic.Id, clinician.Id, MembershipRole.Clinician, now));
        db.Patients.Add(patient);
        db.DentalEncounters.Add(encounter);
        await db.SaveChangesAsync();

        return new Seed(clinic, admin, patient, encounter, _factory.CreateAuthenticatedClient(admin, clinic.Id, MembershipRole.ClinicAdmin));
    }

    private async Task<ProcedureCatalogItem> AddCatalogItemAsync(Seed seed, string code, decimal price)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
        var item = ProcedureCatalogItem.Create(seed.Clinic.Id, code, $"Procedure {code}", null, "General", price, 30, DateTime.UtcNow);
        db.ProcedureCatalogItems.Add(item);
        await db.SaveChangesAsync();
        return item;
    }

    [Fact]
    public async Task Catalog_DuplicateCode_Returns409_ForeignClinicIsolation()
    {
        var seed = await SeedAsync("PLAN-1");
        await AddCatalogItemAsync(seed, "DUP-1", 500m);

        var duplicate = await seed.Client.PostAsJsonAsync("/api/v1/catalog", new { code = "DUP-1", name = "Copy", defaultPrice = 100m, estimatedDurationMinutes = 30 });
        duplicate.StatusCode.Should().Be(HttpStatusCode.Conflict);

        // Another clinic may reuse the same code
        var seedB = await SeedAsync("PLAN-2");
        var foreign = await seedB.Client.PostAsJsonAsync("/api/v1/catalog", new { code = "DUP-1", name = "Other clinic", defaultPrice = 100m, estimatedDurationMinutes = 30 });
        foreign.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task Plan_FullLifecycle_WithServerComputedEstimate()
    {
        var seed = await SeedAsync("PLAN-3");
        var item1 = await AddCatalogItemAsync(seed, "ENDO-1", 2500.50m);
        var item2 = await AddCatalogItemAsync(seed, "CROWN-1", 8000m);

        var created = await seed.Client.PostAsJsonAsync("/api/v1/treatment-plans", new
        {
            patientId = seed.Patient.Id,
            sourceEncounterId = seed.Encounter.Id
        });
        created.StatusCode.Should().Be(HttpStatusCode.Created);
        var plan = await created.Content.ReadFromJsonAsync<TreatmentPlanDto>();
        plan!.Status.Should().Be(TreatmentPlanStatus.Draft);
        plan.EstimateTotal.Should().Be(0m);

        // Add two items with quantities
        var addResponse = await seed.Client.PostAsJsonAsync($"/api/v1/treatment-plans/{plan.Id}/items",
            new { catalogItemId = item1.Id, toothFdi = "16", phase = "Phase 1", quantity = 2 });
        addResponse.StatusCode.Should().Be(HttpStatusCode.OK, await addResponse.Content.ReadAsStringAsync());
        plan = await addResponse.Content.ReadFromJsonAsync<TreatmentPlanDto>();
        plan!.EstimateTotal.Should().Be(5001.00m);

        plan = await (await seed.Client.PostAsJsonAsync($"/api/v1/treatment-plans/{plan.Id}/items",
            new { catalogItemId = item2.Id, toothFdi = "26", quantity = 1 })).Content.ReadFromJsonAsync<TreatmentPlanDto>();
        plan!.EstimateTotal.Should().Be(13001.00m);

        // Submit → Approve (server state machine)
        plan = await (await seed.Client.PostAsync($"/api/v1/treatment-plans/{plan.Id}/submit", content: null)).Content.ReadFromJsonAsync<TreatmentPlanDto>();
        plan!.Status.Should().Be(TreatmentPlanStatus.Proposed);

        plan = await (await seed.Client.PostAsync($"/api/v1/treatment-plans/{plan.Id}/approve", content: null)).Content.ReadFromJsonAsync<TreatmentPlanDto>();
        plan!.Status.Should().Be(TreatmentPlanStatus.Approved);
        plan.ApprovedAtUtc.Should().NotBeNull();

        // Approved plan is sealed: item mutation rejected
        var lateAdd = await seed.Client.PostAsJsonAsync($"/api/v1/treatment-plans/{plan.Id}/items",
            new { catalogItemId = item1.Id, quantity = 1 });
        lateAdd.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        // Empty plan cannot be submitted
        var emptyPlan = await (await seed.Client.PostAsJsonAsync("/api/v1/treatment-plans", new
        {
            patientId = seed.Patient.Id,
            sourceEncounterId = seed.Encounter.Id
        })).Content.ReadFromJsonAsync<TreatmentPlanDto>();
        var submitEmpty = await seed.Client.PostAsync($"/api/v1/treatment-plans/{emptyPlan!.Id}/submit", content: null);
        submitEmpty.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Plan_PriceSnapshotIsolatedFromLaterCatalogChanges()
    {
        var seed = await SeedAsync("PLAN-4");
        var catalog = await AddCatalogItemAsync(seed, "SNAP-1", 500m);

        var created = await seed.Client.PostAsJsonAsync("/api/v1/treatment-plans", new
        {
            patientId = seed.Patient.Id,
            sourceEncounterId = seed.Encounter.Id
        });
        var plan = await created.Content.ReadFromJsonAsync<TreatmentPlanDto>();
        plan = await (await seed.Client.PostAsJsonAsync($"/api/v1/treatment-plans/{plan!.Id}/items",
            new { catalogItemId = catalog.Id, quantity = 1 })).Content.ReadFromJsonAsync<TreatmentPlanDto>();
        plan!.EstimateTotal.Should().Be(500m);

        // Catalog price changes afterwards (FR-405)
        await seed.Client.PutAsJsonAsync($"/api/v1/catalog/{catalog.Id}", new
        {
            itemId = catalog.Id,
            name = "Procedure SNAP-1",
            defaultPrice = 1500m,
            estimatedDurationMinutes = 30
        });

        var reloaded = await seed.Client.GetFromJsonAsync<TreatmentPlanDto>($"/api/v1/treatment-plans/{plan.Id}");
        reloaded!.EstimateTotal.Should().Be(500m);
        reloaded.Items.Single().UnitPriceSnapshot.Should().Be(500m);
    }

    [Fact]
    public async Task Plan_ForeignCatalogItem_Returns404()
    {
        var seed = await SeedAsync("PLAN-5");
        var (foreignClinic, _, _, _, foreignClient) = await SeedAsync("PLAN-5B");
        var foreignItem = await AddCatalogItemAsync(new Seed(foreignClinic, null!, null!, null!, foreignClient), "FOR-1", 500m);

        var created = await seed.Client.PostAsJsonAsync("/api/v1/treatment-plans", new
        {
            patientId = seed.Patient.Id,
            sourceEncounterId = seed.Encounter.Id
        });
        var plan = await created.Content.ReadFromJsonAsync<TreatmentPlanDto>();

        // Try to inject the foreign clinic's procedure
        var injection = await seed.Client.PostAsJsonAsync($"/api/v1/treatment-plans/{plan!.Id}/items",
            new { catalogItemId = foreignItem.Id, quantity = 1 });

        injection.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Plan_EncounterOfAnotherPatient_Returns409()
    {
        var seed = await SeedAsync("PLAN-6");
        var stranger = Patient.Create(seed.Clinic.Id, "Інший", "Пацієнт", null, null, null, null, null, null, DateTime.UtcNow);
        var strangerEncounter = DentalEncounter.Start(seed.Clinic.Id, stranger.Id, seed.Clinician.Id, DateTime.UtcNow, null, DateTime.UtcNow);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
            db.Patients.Add(stranger);
            db.DentalEncounters.Add(strangerEncounter);
            await db.SaveChangesAsync();
        }

        var response = await seed.Client.PostAsJsonAsync("/api/v1/treatment-plans", new
        {
            patientId = seed.Patient.Id,
            sourceEncounterId = strangerEncounter.Id
        });

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Plans_ByPatient_ReturnOnlyOwnClinicPlans()
    {
        var seed = await SeedAsync("PLAN-7");
        var (clinicB, _, patientB, encounterB, clientB) = await SeedAsync("PLAN-7B");

        await seed.Client.PostAsJsonAsync("/api/v1/treatment-plans", new { patientId = seed.Patient.Id, sourceEncounterId = seed.Encounter.Id });
        await clientB.PostAsJsonAsync("/api/v1/treatment-plans", new { patientId = patientB.Id, sourceEncounterId = encounterB.Id });

        var listA = await seed.Client.GetFromJsonAsync<List<TreatmentPlanDto>>($"/api/v1/treatment-plans/by-patient/{seed.Patient.Id}");
        listA!.Should().HaveCount(1);
        listA[0].ClinicId.Should().Be(seed.Clinic.Id);

        // Clinic A cannot see clinic B's plan by guessing (no enumeration)
        var foreignPlan = await seed.Client.PostAsJsonAsync("/api/v1/treatment-plans", new { patientId = patientB.Id, sourceEncounterId = encounterB.Id });
        foreignPlan.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
