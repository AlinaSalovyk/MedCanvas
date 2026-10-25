using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using MedCanvas.Api.IntegrationTests.Infrastructure;
using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Application.Features.Billing;
using MedCanvas.Domain.Entities;
using MedCanvas.Domain.Enums;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace MedCanvas.Api.IntegrationTests.Controllers;

/// <summary>
/// M07 demo billing: invoices from performed procedures, simulated payments with
/// idempotent retries, overpay rejection, status transitions, isolation. Every
/// payment is explicitly SIMULATED (IsDemo) — no real money exists anywhere.
/// </summary>
public class BillingTests : IClassFixture<MedCanvasApiFactory>, IAsyncLifetime
{
    private readonly MedCanvasApiFactory _factory;

    public BillingTests(MedCanvasApiFactory factory)
    {
        _factory = factory;
    }

    public async Task InitializeAsync()
    {
        await _factory.ResetDatabaseAsync();
    }

    public Task DisposeAsync() => Task.CompletedTask;

    private sealed record Seed(Clinic Clinic, User Admin, Patient Patient, DentalEncounter Encounter, HttpClient Client);

    private async Task<Seed> SeedAsync(string identifier)
    {
        var now = DateTime.UtcNow;
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();

        var clinic = Clinic.Create($"Clinic {identifier}", identifier, now);
        var admin = User.Create($"admin-{identifier.ToLowerInvariant()}@example.com", "Admin Bill", "hash", now);
        var patient = Patient.Create(clinic.Id, "Біл", "Тестовий", null, null, null, null, null, null, now);
        var encounter = DentalEncounter.Start(clinic.Id, patient.Id, admin.Id, now, "Billing visit", now);

        db.Clinics.Add(clinic);
        db.Users.Add(admin);
        db.ClinicMemberships.Add(ClinicMembership.Create(clinic.Id, admin.Id, MembershipRole.ClinicAdmin, now));
        db.Patients.Add(patient);
        db.DentalEncounters.Add(encounter);
        await db.SaveChangesAsync();

        return new Seed(clinic, admin, patient, encounter, _factory.CreateAuthenticatedClient(admin, clinic.Id, MembershipRole.ClinicAdmin));
    }

    private async Task<PerformedProcedure> RecordProcedureAsync(Seed seed, decimal price, string code)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
        var catalog = ProcedureCatalogItem.Create(seed.Clinic.Id, code, $"Proc {code}", null, null, price, 30, DateTime.UtcNow);
        var performed = PerformedProcedure.Record(
            seed.Clinic.Id, seed.Patient.Id, seed.Encounter.Id, null, catalog.Id, "16", 1,
            seed.Admin.Id, price, null, $"idem-{code}-{Guid.NewGuid():N}", DateTime.UtcNow);
        db.ProcedureCatalogItems.Add(catalog);
        db.PerformedProcedures.Add(performed);
        await db.SaveChangesAsync();
        return performed;
    }

    [Fact]
    public async Task CreateInvoice_ComputesTotalServerSide_FromRecordedProcedures()
    {
        var seed = await SeedAsync("BILL-1");
        await RecordProcedureAsync(seed, 900.50m, "BILL-A");
        await RecordProcedureAsync(seed, 100.25m, "BILL-B");

        var response = await seed.Client.PostAsJsonAsync($"/api/v1/invoices/from-encounter/{seed.Encounter.Id}", new { });

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var invoice = await response.Content.ReadFromJsonAsync<InvoiceDto>();
        invoice!.TotalAmount.Should().Be(1000.75m);
        invoice.IsDemo.Should().BeTrue();
        invoice.Status.Should().Be(InvoiceStatus.Issued);
        invoice.Lines.Should().HaveCount(2);
        invoice.InvoiceNumber.Should().StartWith("INV-");
    }

    [Fact]
    public async Task CreateInvoice_WithNoBillableProcedures_Returns409()
    {
        var seed = await SeedAsync("BILL-2");

        var response = await seed.Client.PostAsJsonAsync($"/api/v1/invoices/from-encounter/{seed.Encounter.Id}", new { });

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task SimulatedPayments_PartialThenFull_TransitionsStatus()
    {
        var seed = await SeedAsync("BILL-3");
        await RecordProcedureAsync(seed, 1000m, "BILL-C");
        var created = await seed.Client.PostAsJsonAsync($"/api/v1/invoices/from-encounter/{seed.Encounter.Id}", new { });
        var invoice = await created.Content.ReadFromJsonAsync<InvoiceDto>();

        var partial = await seed.Client.PostAsJsonAsync($"/api/v1/invoices/{invoice!.Id}/simulated-payments", new
        {
            amount = 400m,
            methodLabel = "Каса (демо)",
            idempotencyKey = "pay-1"
        });
        partial.StatusCode.Should().Be(HttpStatusCode.OK);
        var afterPartial = await partial.Content.ReadFromJsonAsync<InvoiceDto>();
        afterPartial!.Status.Should().Be(InvoiceStatus.PartiallySimulated);
        afterPartial.SimulatedPaid.Should().Be(400m);
        afterPartial.RemainingBalance.Should().Be(600m);
        afterPartial.IsDemo.Should().BeTrue();

        var full = await seed.Client.PostAsJsonAsync($"/api/v1/invoices/{invoice.Id}/simulated-payments", new
        {
            amount = 600m,
            methodLabel = "Каса (демо)",
            idempotencyKey = "pay-2"
        });
        var afterFull = await full.Content.ReadFromJsonAsync<InvoiceDto>();
        afterFull!.Status.Should().Be(InvoiceStatus.FullySimulated);
        afterFull.RemainingBalance.Should().Be(0m);
    }

    [Fact]
    public async Task SimulatedPayment_Overpay_Returns400()
    {
        var seed = await SeedAsync("BILL-4");
        await RecordProcedureAsync(seed, 500m, "BILL-D");
        var created = await seed.Client.PostAsJsonAsync($"/api/v1/invoices/from-encounter/{seed.Encounter.Id}", new { });
        var invoice = await created.Content.ReadFromJsonAsync<InvoiceDto>();

        var response = await seed.Client.PostAsJsonAsync($"/api/v1/invoices/{invoice!.Id}/simulated-payments", new
        {
            amount = 600m,
            methodLabel = "Демо",
            idempotencyKey = "pay-over"
        });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task SimulatedPayment_RetriedWithSameKey_DoesNotDuplicate()
    {
        var seed = await SeedAsync("BILL-5");
        await RecordProcedureAsync(seed, 500m, "BILL-E");
        var created = await seed.Client.PostAsJsonAsync($"/api/v1/invoices/from-encounter/{seed.Encounter.Id}", new { });
        var invoice = await created.Content.ReadFromJsonAsync<InvoiceDto>();
        var body = new { amount = 200m, methodLabel = "Демо", idempotencyKey = "pay-retry" };

        var first = await seed.Client.PostAsJsonAsync($"/api/v1/invoices/{invoice!.Id}/simulated-payments", body);
        var second = await seed.Client.PostAsJsonAsync($"/api/v1/invoices/{invoice.Id}/simulated-payments", body);

        first.StatusCode.Should().Be(HttpStatusCode.OK);
        second.StatusCode.Should().Be(HttpStatusCode.OK);

        var reloaded = await seed.Client.GetFromJsonAsync<InvoiceDto>($"/api/v1/invoices/{invoice.Id}");
        reloaded!.Payments.Should().HaveCount(1);
        reloaded.SimulatedPaid.Should().Be(200m);
    }

    [Fact]
    public async Task VoidInvoice_SetsVoidedStatus()
    {
        var seed = await SeedAsync("BILL-6");
        await RecordProcedureAsync(seed, 500m, "BILL-F");
        var created = await seed.Client.PostAsJsonAsync($"/api/v1/invoices/from-encounter/{seed.Encounter.Id}", new { });
        var invoice = await created.Content.ReadFromJsonAsync<InvoiceDto>();

        var response = await seed.Client.PostAsJsonAsync($"/api/v1/invoices/{invoice!.Id}/void", new { reason = "Issued by mistake" });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        (await response.Content.ReadFromJsonAsync<InvoiceDto>())!.Status.Should().Be(InvoiceStatus.Voided);
    }

    [Fact]
    public async Task Invoices_AreClinicScoped()
    {
        var seedA = await SeedAsync("BILL-7A");
        var seedB = await SeedAsync("BILL-7B");
        await RecordProcedureAsync(seedA, 500m, "BILL-G");
        var created = await seedA.Client.PostAsJsonAsync($"/api/v1/invoices/from-encounter/{seedA.Encounter.Id}", new { });
        var invoice = await created.Content.ReadFromJsonAsync<InvoiceDto>();

        var foreign = await seedB.Client.GetAsync($"/api/v1/invoices/{invoice!.Id}");
        foreign.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task SimulatedPayment_WithNegativeAmount_Returns400()
    {
        var seed = await SeedAsync("BILL-8");
        await RecordProcedureAsync(seed, 500m, "BILL-H");
        var created = await seed.Client.PostAsJsonAsync($"/api/v1/invoices/from-encounter/{seed.Encounter.Id}", new { });
        var invoice = await created.Content.ReadFromJsonAsync<InvoiceDto>();

        var response = await seed.Client.PostAsJsonAsync($"/api/v1/invoices/{invoice!.Id}/simulated-payments", new
        {
            amount = -100m,
            methodLabel = "Демо",
            idempotencyKey = "pay-neg"
        });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }
}
