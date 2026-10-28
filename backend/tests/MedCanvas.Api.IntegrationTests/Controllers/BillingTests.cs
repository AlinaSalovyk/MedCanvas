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
        var extraCatalog = await RecordProcedureAsync(seed, 0m, "EXTRA");
        // No new chargeable work may silently fall outside the issued snapshot.
        var extra = await seed.Client.PostAsJsonAsync($"/api/v1/encounters/{seed.Encounter.Id}/performed-procedures", new
        {
            catalogItemId = extraCatalog.ProcedureCatalogItemId,
            quantity = 1,
            idempotencyKey = "after-issue"
        });
        extra.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task CreateInvoice_WithNoBillableProcedures_Returns409()
    {
        var seed = await SeedAsync("BILL-2");

        var response = await seed.Client.PostAsJsonAsync($"/api/v1/invoices/from-encounter/{seed.Encounter.Id}", new { });

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(200)]
    [InlineData(1000)]
    public async Task CreateInvoice_AlreadyIssued_RejectsDuplicateRegardlessOfPayments(int paid)
    {
        var seed = await SeedAsync("DUP-INV");
        await RecordProcedureAsync(seed, 1000m, "DUP");
        var first = await seed.Client.PostAsync($"/api/v1/invoices/from-encounter/{seed.Encounter.Id}", null);
        first.StatusCode.Should().Be(HttpStatusCode.Created);
        var invoice = (await first.Content.ReadFromJsonAsync<InvoiceDto>())!;
        if (paid > 0)
        {
            var payment = await seed.Client.PostAsJsonAsync($"/api/v1/invoices/{invoice.Id}/simulated-payments",
                new { amount = paid, methodLabel = "Demo", idempotencyKey = "initial" });
            payment.StatusCode.Should().Be(HttpStatusCode.OK);
        }

        var duplicate = await seed.Client.PostAsync($"/api/v1/invoices/from-encounter/{seed.Encounter.Id}", null);
        duplicate.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var persisted = await seed.Client.GetFromJsonAsync<List<InvoiceDto>>($"/api/v1/invoices/by-patient/{seed.Patient.Id}");
        persisted.Should().ContainSingle();
    }

    [Fact]
    public async Task InvoiceLines_SurviveProcedureVoidAndCatalogChanges()
    {
        var seed = await SeedAsync("SNAPSHOT");
        var procedure = await RecordProcedureAsync(seed, 1000m, "ORIGINAL");
        var response = await seed.Client.PostAsync($"/api/v1/invoices/from-encounter/{seed.Encounter.Id}", null);
        var issued = (await response.Content.ReadFromJsonAsync<InvoiceDto>())!;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
            var stored = await db.PerformedProcedures.FindAsync(procedure.Id);
            stored!.Void(seed.Admin.Id, "Correction", DateTime.UtcNow);
            var catalog = await db.ProcedureCatalogItems.FindAsync(procedure.ProcedureCatalogItemId);
            catalog!.Update("Changed description", null, null, 9999m, 30, DateTime.UtcNow);
            await db.SaveChangesAsync();
        }

        var reloaded = (await seed.Client.GetFromJsonAsync<InvoiceDto>($"/api/v1/invoices/{issued.Id}"))!;
        reloaded.Lines.Should().BeEquivalentTo(issued.Lines);
        reloaded.Lines.Sum(l => l.TotalAmount).Should().Be(reloaded.TotalAmount);
    }

    [Fact]
    public async Task PaymentKey_ConflictingPayload_Returns409()
    {
        var seed = await SeedAsync("KEY-CONFLICT");
        await RecordProcedureAsync(seed, 1000m, "KEY");
        var created = await seed.Client.PostAsync($"/api/v1/invoices/from-encounter/{seed.Encounter.Id}", null);
        var invoice = (await created.Content.ReadFromJsonAsync<InvoiceDto>())!;
        var path = $"/api/v1/invoices/{invoice.Id}/simulated-payments";
        (await seed.Client.PostAsJsonAsync(path, new { amount = 200m, methodLabel = "Demo", idempotencyKey = "same" }))
            .StatusCode.Should().Be(HttpStatusCode.OK);
        (await seed.Client.PostAsJsonAsync(path, new { amount = 300m, methodLabel = "Demo", idempotencyKey = "same" }))
            .StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task CreateInvoice_ConcurrentRequests_OnlyOneActiveInvoice()
    {
        var seed = await SeedAsync("RACE-ISSUE");
        await RecordProcedureAsync(seed, 1000m, "RACE");
        var path = $"/api/v1/invoices/from-encounter/{seed.Encounter.Id}";
        var results = await Task.WhenAll(Enumerable.Range(0, 6).Select(_ => seed.Client.PostAsync(path, null)));
        results.Count(r => r.StatusCode == HttpStatusCode.Created).Should().Be(1);
        results.Count(r => r.StatusCode == HttpStatusCode.Conflict).Should().Be(5);
        var invoices = await seed.Client.GetFromJsonAsync<List<InvoiceDto>>($"/api/v1/invoices/by-patient/{seed.Patient.Id}");
        invoices.Should().ContainSingle();
        invoices![0].Lines.Should().ContainSingle();
    }

    [Theory]
    [InlineData(700, 700, 1, 700)]
    [InlineData(400, 600, 2, 1000)]
    public async Task SimulatedPayments_Concurrent_PreserveBalance(int amountA, int amountB, int successes, int total)
    {
        var seed = await SeedAsync("RACE-PAY");
        await RecordProcedureAsync(seed, 1000m, "RACE");
        var created = await seed.Client.PostAsync($"/api/v1/invoices/from-encounter/{seed.Encounter.Id}", null);
        var invoice = (await created.Content.ReadFromJsonAsync<InvoiceDto>())!;
        var path = $"/api/v1/invoices/{invoice.Id}/simulated-payments";
        var results = await Task.WhenAll(
            seed.Client.PostAsJsonAsync(path, new { amount = amountA, methodLabel = "Demo", idempotencyKey = "race-a" }),
            seed.Client.PostAsJsonAsync(path, new { amount = amountB, methodLabel = "Demo", idempotencyKey = "race-b" }));
        results.Count(r => r.StatusCode == HttpStatusCode.OK).Should().Be(successes);
        results.Should().OnlyContain(r => r.StatusCode == HttpStatusCode.OK || r.StatusCode == HttpStatusCode.BadRequest);
        var reloaded = (await seed.Client.GetFromJsonAsync<InvoiceDto>($"/api/v1/invoices/{invoice.Id}"))!;
        reloaded.SimulatedPaid.Should().Be(total);
        reloaded.Payments.Sum(p => p.Amount).Should().Be(total);
        reloaded.RemainingBalance.Should().Be(1000 - total);
    }

    [Fact]
    public async Task SimulatedPayments_ConcurrentSameKey_ReturnOriginalWithoutDuplication()
    {
        var seed = await SeedAsync("RACE-KEY");
        await RecordProcedureAsync(seed, 1000m, "RACE");
        var created = await seed.Client.PostAsync($"/api/v1/invoices/from-encounter/{seed.Encounter.Id}", null);
        var invoice = (await created.Content.ReadFromJsonAsync<InvoiceDto>())!;
        var path = $"/api/v1/invoices/{invoice.Id}/simulated-payments";
        var results = await Task.WhenAll(Enumerable.Range(0, 4).Select(_ => seed.Client.PostAsJsonAsync(path,
            new { amount = 700m, methodLabel = "Demo", idempotencyKey = "same" })));
        results.Should().OnlyContain(r => r.StatusCode == HttpStatusCode.OK);
        var reloaded = (await seed.Client.GetFromJsonAsync<InvoiceDto>($"/api/v1/invoices/{invoice.Id}"))!;
        reloaded.Payments.Should().ContainSingle();
        reloaded.SimulatedPaid.Should().Be(700m);
    }

    [Fact]
    public async Task VoidAndReissue_UnpaidInvoice_PreservesHistory()
    {
        var seed = await SeedAsync("REISSUE");
        await RecordProcedureAsync(seed, 1000m, "REISSUE");
        var path = $"/api/v1/invoices/from-encounter/{seed.Encounter.Id}";
        var first = await seed.Client.PostAsync(path, null);
        var invoice = (await first.Content.ReadFromJsonAsync<InvoiceDto>())!;
        (await seed.Client.PostAsJsonAsync($"/api/v1/invoices/{invoice.Id}/void", new { reason = "Correction" }))
            .StatusCode.Should().Be(HttpStatusCode.OK);
        var reissued = await seed.Client.PostAsync(path, null);
        reissued.StatusCode.Should().Be(HttpStatusCode.Created);
        var replacement = (await reissued.Content.ReadFromJsonAsync<InvoiceDto>())!;
        replacement.Id.Should().NotBe(invoice.Id);
        replacement.Lines.Should().BeEquivalentTo(invoice.Lines);
        var original = (await seed.Client.GetFromJsonAsync<InvoiceDto>($"/api/v1/invoices/{invoice.Id}"))!;
        original.Status.Should().Be(InvoiceStatus.Voided);
        original.Lines.Should().BeEquivalentTo(invoice.Lines);
        (await seed.Client.PostAsJsonAsync($"/api/v1/invoices/{invoice.Id}/simulated-payments",
            new { amount = 100m, methodLabel = "Demo", idempotencyKey = "voided" }))
            .StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task PaymentAndVoid_Concurrent_OnlyOneCommits()
    {
        var seed = await SeedAsync("VOID-PAY");
        await RecordProcedureAsync(seed, 1000m, "RACE");
        var created = await seed.Client.PostAsync($"/api/v1/invoices/from-encounter/{seed.Encounter.Id}", null);
        var invoice = (await created.Content.ReadFromJsonAsync<InvoiceDto>())!;
        var results = await Task.WhenAll(
            seed.Client.PostAsJsonAsync($"/api/v1/invoices/{invoice.Id}/simulated-payments",
                new { amount = 700m, methodLabel = "Demo", idempotencyKey = "race" }),
            seed.Client.PostAsJsonAsync($"/api/v1/invoices/{invoice.Id}/void", new { reason = "Correction" }));
        results.Count(r => r.StatusCode == HttpStatusCode.OK).Should().Be(1);
        results.Count(r => r.StatusCode == HttpStatusCode.BadRequest).Should().Be(1);
        var reloaded = (await seed.Client.GetFromJsonAsync<InvoiceDto>($"/api/v1/invoices/{invoice.Id}"))!;
        if (reloaded.Status == InvoiceStatus.Voided) reloaded.SimulatedPaid.Should().Be(0m);
        else reloaded.SimulatedPaid.Should().Be(700m);
    }

    [Theory]
    [InlineData("0")]
    [InlineData("-0.01")]
    [InlineData("0.001")]
    [InlineData("999999.01")]
    public async Task SimulatedPayment_InvalidPrecisionOrRange_Returns400(string value)
    {
        var seed = await SeedAsync("PRECISION");
        var response = await seed.Client.PostAsJsonAsync($"/api/v1/invoices/{Guid.NewGuid()}/simulated-payments",
            new { amount = decimal.Parse(value, System.Globalization.CultureInfo.InvariantCulture), methodLabel = "Demo", idempotencyKey = "invalid" });
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
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
        (await seedB.Client.PostAsync($"/api/v1/invoices/from-encounter/{seedA.Encounter.Id}", null))
            .StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await seedB.Client.PostAsJsonAsync($"/api/v1/invoices/{invoice.Id}/simulated-payments",
            new { amount = 100m, methodLabel = "Demo", idempotencyKey = "foreign" }))
            .StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await seedB.Client.PostAsJsonAsync($"/api/v1/invoices/{invoice.Id}/void", new { reason = "Foreign" }))
            .StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Theory]
    [InlineData(MembershipRole.ClinicAdmin, HttpStatusCode.OK)]
    [InlineData(MembershipRole.Assistant, HttpStatusCode.OK)]
    [InlineData(MembershipRole.Clinician, HttpStatusCode.Forbidden)]
    [InlineData(MembershipRole.Viewer, HttpStatusCode.Forbidden)]
    public async Task SimulatedPayment_EnforcesFinanceRolePolicy(MembershipRole role, HttpStatusCode expected)
    {
        var seed = await SeedAsync("PAY-ROLE");
        await RecordProcedureAsync(seed, 1000m, "ROLE");
        var created = await seed.Client.PostAsync($"/api/v1/invoices/from-encounter/{seed.Encounter.Id}", null);
        var invoice = (await created.Content.ReadFromJsonAsync<InvoiceDto>())!;
        var actor = User.Create("finance-actor@example.test", "Synthetic", "hash", DateTime.UtcNow);
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
            db.Users.Add(actor);
            db.ClinicMemberships.Add(ClinicMembership.Create(seed.Clinic.Id, actor.Id, role, DateTime.UtcNow));
            await db.SaveChangesAsync();
        }
        var client = _factory.CreateAuthenticatedClient(actor, seed.Clinic.Id, role);
        (await client.PostAsJsonAsync($"/api/v1/invoices/{invoice.Id}/simulated-payments",
            new { amount = 100m, methodLabel = "Demo", idempotencyKey = "finance-role" }))
            .StatusCode.Should().Be(expected);
    }

    [Fact]
    public async Task PaymentKey_ConflictingInvoice_Returns409()
    {
        var seed = await SeedAsync("KEY-INVOICE");
        await RecordProcedureAsync(seed, 1000m, "KEY");
        var created = await seed.Client.PostAsync($"/api/v1/invoices/from-encounter/{seed.Encounter.Id}", null);
        var invoice = (await created.Content.ReadFromJsonAsync<InvoiceDto>())!;
        var body = new { amount = 100m, methodLabel = "Demo", idempotencyKey = "shared-key" };
        (await seed.Client.PostAsJsonAsync($"/api/v1/invoices/{invoice.Id}/simulated-payments", body)).StatusCode.Should().Be(HttpStatusCode.OK);
        (await seed.Client.PostAsJsonAsync($"/api/v1/invoices/{Guid.NewGuid()}/simulated-payments", body)).StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task LegacyInvoice_ExposesMissingSnapshot_AndRejectsNewPayments()
    {
        var seed = await SeedAsync("LEGACY-PAY");
        var legacy = Invoice.Create(seed.Clinic.Id, seed.Patient.Id, seed.Encounter.Id, "LEGACY", 1000m, seed.Admin.Id, DateTime.UtcNow);
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
            db.Invoices.Add(legacy);
            await db.SaveChangesAsync();
        }
        var dto = (await seed.Client.GetFromJsonAsync<InvoiceDto>($"/api/v1/invoices/{legacy.Id}"))!;
        dto.HasLineSnapshot.Should().BeFalse();
        dto.Lines.Should().BeEmpty();
        dto.TotalAmount.Should().Be(1000m);
        (await seed.Client.PostAsJsonAsync($"/api/v1/invoices/{legacy.Id}/simulated-payments",
            new { amount = 100m, methodLabel = "Demo", idempotencyKey = "legacy" }))
            .StatusCode.Should().Be(HttpStatusCode.Conflict);
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
