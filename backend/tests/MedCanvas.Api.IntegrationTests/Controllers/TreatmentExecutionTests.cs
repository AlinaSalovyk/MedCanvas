using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using MedCanvas.Api.IntegrationTests.Infrastructure;
using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Application.Features.TreatmentExecution;
using MedCanvas.Domain.Entities;
using MedCanvas.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace MedCanvas.Api.IntegrationTests.Controllers;

/// <summary>
/// M06 performed procedures: explicit recording on an open encounter, idempotent
/// retries (FR-505), plan-item linkage with snapshot pricing, and compensating
/// voids (FR-506 — history never rewritten).
/// </summary>
public class TreatmentExecutionTests : IClassFixture<MedCanvasApiFactory>, IAsyncLifetime
{
    private readonly MedCanvasApiFactory _factory;

    public TreatmentExecutionTests(MedCanvasApiFactory factory)
    {
        _factory = factory;
    }

    public async Task InitializeAsync()
    {
        await _factory.ResetDatabaseAsync();
    }

    public Task DisposeAsync() => Task.CompletedTask;

    private sealed record Seed(Clinic Clinic, User Admin, User Clinician, Patient Patient, DentalEncounter Encounter, HttpClient Client);

    private async Task<Seed> SeedAsync(string identifier, bool completeEncounter = false)
    {
        var now = DateTime.UtcNow;
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();

        var clinic = Clinic.Create($"Clinic {identifier}", identifier, now);
        var admin = User.Create($"admin-{identifier.ToLowerInvariant()}@example.com", "Admin", "hash", now);
        var clinician = User.Create($"doc-{identifier.ToLowerInvariant()}@example.com", "Dr. Exec", "hash", now);
        var patient = Patient.Create(clinic.Id, "Пацієнт", "Виконаний", null, null, null, null, null, null, now);
        var encounter = DentalEncounter.Start(clinic.Id, patient.Id, clinician.Id, now, "Execution visit", now);
        if (completeEncounter)
        {
            encounter.Complete(now, "done");
        }

        db.Clinics.Add(clinic);
        db.Users.AddRange(admin, clinician);
        db.ClinicMemberships.Add(ClinicMembership.Create(clinic.Id, admin.Id, MembershipRole.ClinicAdmin, now));
        db.ClinicMemberships.Add(ClinicMembership.Create(clinic.Id, clinician.Id, MembershipRole.Clinician, now));
        db.Patients.Add(patient);
        db.DentalEncounters.Add(encounter);
        await db.SaveChangesAsync();

        return new Seed(clinic, admin, clinician, patient, encounter, _factory.CreateAuthenticatedClient(clinician, clinic.Id, MembershipRole.Clinician));
    }

    private async Task<ProcedureCatalogItem> AddCatalogAsync(Seed seed, string code, decimal price)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
        var item = ProcedureCatalogItem.Create(seed.Clinic.Id, code, $"Proc {code}", null, null, price, 30, DateTime.UtcNow);
        db.ProcedureCatalogItems.Add(item);
        await db.SaveChangesAsync();
        return item;
    }

    [Fact]
    public async Task Record_OnOpenEncounter_Returns201WithServerSnapshot()
    {
        var seed = await SeedAsync("EXEC-1");
        var catalog = await AddCatalogAsync(seed, "FILL-1", 900.55m);

        var response = await seed.Client.PostAsJsonAsync($"/api/v1/encounters/{seed.Encounter.Id}/performed-procedures", new
        {
            catalogItemId = catalog.Id,
            idempotencyKey = "idem-exec-1",
            toothFdi = "16",
            quantity = 2,
            clinicalNote = "Two surfaces"
        });

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var dto = await response.Content.ReadFromJsonAsync<PerformedProcedureDto>();
        dto!.UnitPriceSnapshot.Should().Be(900.55m);
        dto.TotalAmount.Should().Be(1801.10m);
        dto.Status.Should().Be(PerformedProcedureStatus.Recorded);
    }

    [Fact]
    public async Task Record_RetriedWithSameIdempotencyKey_ReturnsOriginalWithoutDoubleCharge()
    {
        var seed = await SeedAsync("EXEC-2");
        var catalog = await AddCatalogAsync(seed, "FILL-2", 500m);
        var body = new
        {
            catalogItemId = catalog.Id,
            idempotencyKey = "retry-key-1",
            quantity = 1
        };

        var first = await seed.Client.PostAsJsonAsync($"/api/v1/encounters/{seed.Encounter.Id}/performed-procedures", body);
        var second = await seed.Client.PostAsJsonAsync($"/api/v1/encounters/{seed.Encounter.Id}/performed-procedures", body);

        first.StatusCode.Should().Be(HttpStatusCode.Created);
        second.StatusCode.Should().Be(HttpStatusCode.Created);

        var original = await first.Content.ReadFromJsonAsync<PerformedProcedureDto>();
        var replay = await second.Content.ReadFromJsonAsync<PerformedProcedureDto>();
        replay!.Id.Should().Be(original!.Id);

        var list = await seed.Client.GetFromJsonAsync<List<PerformedProcedureDto>>(
            $"/api/v1/encounters/{seed.Encounter.Id}/performed-procedures");
        list!.Should().HaveCount(1);
    }

    [Fact]
    public async Task Record_OnCompletedEncounter_Returns400()
    {
        var seed = await SeedAsync("EXEC-3", completeEncounter: true);
        var catalog = await AddCatalogAsync(seed, "FILL-3", 500m);

        var response = await seed.Client.PostAsJsonAsync($"/api/v1/encounters/{seed.Encounter.Id}/performed-procedures", new
        {
            catalogItemId = catalog.Id,
            idempotencyKey = "idem-exec-3"
        });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Record_WithForeignCatalogItem_Returns404()
    {
        var seed = await SeedAsync("EXEC-4");
        var seedB = await SeedAsync("EXEC-4B");
        var foreignCatalog = await AddCatalogAsync(seedB, "FOR-EX", 500m);

        var response = await seed.Client.PostAsJsonAsync($"/api/v1/encounters/{seed.Encounter.Id}/performed-procedures", new
        {
            catalogItemId = foreignCatalog.Id,
            idempotencyKey = "idem-exec-4"
        });

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Record_WithPlanItem_MarksItemPerformedAndMovesPlanInProgress()
    {
        var seed = await SeedAsync("EXEC-5");
        var catalog = await AddCatalogAsync(seed, "PLAN-EX", 1200m);

        var plan = TreatmentPlan.Create(seed.Clinic.Id, seed.Patient.Id, seed.Encounter.Id, seed.Clinician.Id, DateTime.UtcNow);
        plan.AddItem(catalog, "26", null, "Phase 1", 1, null, DateTime.UtcNow);
        plan.SubmitForApproval(DateTime.UtcNow);
        plan.Approve(seed.Admin.Id, DateTime.UtcNow);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
            db.TreatmentPlans.Add(plan);
            await db.SaveChangesAsync();
        }

        var planItemId = plan.Items[0].Id;
        var response = await seed.Client.PostAsJsonAsync($"/api/v1/encounters/{seed.Encounter.Id}/performed-procedures", new
        {
            catalogItemId = catalog.Id,
            idempotencyKey = "idem-exec-5",
            treatmentPlanItemId = planItemId
        });

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var dto = await response.Content.ReadFromJsonAsync<PerformedProcedureDto>();
        dto!.TreatmentPlanItemId.Should().Be(planItemId);
        dto.UnitPriceSnapshot.Should().Be(1200m);

        // Plan moved Approved -> InProgress and the item is marked performed
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
            var reloaded = db.TreatmentPlans.Include(p => p.Items).First(p => p.Id == plan.Id);
            reloaded.Status.Should().Be(TreatmentPlanStatus.InProgress);
            reloaded.Items[0].ItemStatus.Should().Be(TreatmentPlanItemStatus.Performed);
        }
    }

    [Fact]
    public async Task Void_WithReason_KeepsRecordVisibleWithVoidedStatus()
    {
        var seed = await SeedAsync("EXEC-6");
        var catalog = await AddCatalogAsync(seed, "VOID-1", 700m);
        var created = await seed.Client.PostAsJsonAsync($"/api/v1/encounters/{seed.Encounter.Id}/performed-procedures", new
        {
            catalogItemId = catalog.Id,
            idempotencyKey = "idem-exec-6"
        });
        var dto = await created.Content.ReadFromJsonAsync<PerformedProcedureDto>();

        var voidResponse = await seed.Client.PostAsJsonAsync($"/api/v1/performed-procedures/{dto!.Id}/void", new { reason = "Wrong tooth recorded" });
        voidResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var voided = await voidResponse.Content.ReadFromJsonAsync<PerformedProcedureDto>();
        voided!.Status.Should().Be(PerformedProcedureStatus.Voided);
        voided.VoidReason.Should().Be("Wrong tooth recorded");

        // History keeps the record visible (FR-506 — no silent deletion)
        var list = await seed.Client.GetFromJsonAsync<List<PerformedProcedureDto>>(
            $"/api/v1/encounters/{seed.Encounter.Id}/performed-procedures");
        list!.Should().HaveCount(1);
        list[0].Status.Should().Be(PerformedProcedureStatus.Voided);
    }

    [Fact]
    public async Task Void_WithoutReason_Returns400()
    {
        var seed = await SeedAsync("EXEC-7");
        var catalog = await AddCatalogAsync(seed, "VOID-2", 300m);
        var created = await seed.Client.PostAsJsonAsync($"/api/v1/encounters/{seed.Encounter.Id}/performed-procedures", new
        {
            catalogItemId = catalog.Id,
            idempotencyKey = "idem-exec-7"
        });
        var dto = await created.Content.ReadFromJsonAsync<PerformedProcedureDto>();

        var response = await seed.Client.PostAsJsonAsync($"/api/v1/performed-procedures/{dto!.Id}/void", new { reason = "" });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Record_WithInvalidToothFdi_Returns400()
    {
        var seed = await SeedAsync("EXEC-8");
        var catalog = await AddCatalogAsync(seed, "TOOTH-1", 300m);

        var response = await seed.Client.PostAsJsonAsync($"/api/v1/encounters/{seed.Encounter.Id}/performed-procedures", new
        {
            catalogItemId = catalog.Id,
            idempotencyKey = "idem-exec-8",
            toothFdi = "99"
        });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }
}
