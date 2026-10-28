using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using MedCanvas.Api.IntegrationTests.Infrastructure;
using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Application.Features.Billing;
using MedCanvas.Application.Features.Scheduling;
using MedCanvas.Application.Features.TreatmentPlanning;
using MedCanvas.Domain.Entities;
using MedCanvas.Domain.Enums;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace MedCanvas.Api.IntegrationTests.Workflows;

/// <summary>
/// E2E-MVP-001 — Complete Dental Clinic Workflow (TZ §11), executed through the REAL
/// ASP.NET Core HTTP pipeline against REAL PostgreSQL (Testcontainers): appointment →
/// encounter/odontogram → treatment plan → performed procedures → invoice → simulated
/// payments → completion → follow-up → tenant isolation → persistence after reload.
/// Synthetic data only; all payments are SIMULATED (IsDemo).
/// </summary>
public class MvpWorkflowE2ETests : IClassFixture<MedCanvasApiFactory>
{
    private readonly MedCanvasApiFactory _factory;

    public MvpWorkflowE2ETests(MedCanvasApiFactory factory)
    {
        _factory = factory;
    }

    private sealed record ClinicContext(
        Clinic Clinic,
        User Admin,
        User Clinician,
        Patient? Patient,
        DentalEncounter? Encounter,
        HttpClient AdminClient,
        HttpClient ClinicianClient);

    private async Task<ClinicContext> OnboardClinicAsync(string identifier, bool withStaff = true)
    {
        var now = DateTime.UtcNow;
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();

        var clinic = Clinic.Create($"E2E Clinic {identifier}", $"E2E-{identifier}", now);
        var admin = User.Create($"admin-{identifier.ToLowerInvariant()}@e2e.test", "E2E Admin", hasher.HashPassword("E2eStrong#1"), now);
        db.Clinics.Add(clinic);
        db.Users.Add(admin);
        db.ClinicMemberships.Add(ClinicMembership.Create(clinic.Id, admin.Id, MembershipRole.ClinicAdmin, now));

        User? clinician = null;
        if (withStaff)
        {
            clinician = User.Create($"doc-{identifier.ToLowerInvariant()}@e2e.test", "Dr. E2E", hasher.HashPassword("E2eStrong#1"), now);
            db.Users.Add(clinician);
            db.ClinicMemberships.Add(ClinicMembership.Create(clinic.Id, clinician.Id, MembershipRole.Clinician, now));
        }

        await db.SaveChangesAsync();

        return new ClinicContext(
            clinic,
            admin,
            clinician!,
            null,
            null,
            _factory.CreateAuthenticatedClient(admin, clinic.Id, MembershipRole.ClinicAdmin),
            clinician != null
                ? _factory.CreateAuthenticatedClient(clinician, clinic.Id, MembershipRole.Clinician)
                : null!);
    }

    [Fact]
    public async Task E2E_MVP_001_CompleteDentalClinicWorkflow()
    {
        // ===== Initial conditions: Clinic A (admin+clinician), Clinic B for isolation =====
        await _factory.ResetDatabaseAsync();
        var clinicA = await OnboardClinicAsync("A");
        var clinicB = await OnboardClinicAsync("B", withStaff: false);

        var chairId = Guid.NewGuid();
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
            db.ClinicChairs.Add(ClinicChair.CreateWithId(chairId, clinicA.Clinic.Id, "Chair 1", DateTime.UtcNow));
            foreach (var day in Enumerable.Range(1, 7))
                db.ProviderAvailabilities.Add(ProviderAvailability.Create(clinicA.Clinic.Id, clinicA.Clinician.Id,
                    day, new TimeOnly(8, 0), new TimeOnly(18, 0), DateTime.UtcNow));
            await db.SaveChangesAsync();
        }

        // ===== Step 1 — Register the patient (Clinic A) =====
        var patientResponse = await clinicA.AdminClient.PostAsJsonAsync("/api/v1/patients", new
        {
            firstName = "Олена",
            lastName = "Енд-ту-Енд",
            dateOfBirth = "1990-05-14",
            gender = "Female",
            phone = "+380501112233",
            medicalAlerts = "Penicillin allergy"
        });
        patientResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var patient = await patientResponse.Content.ReadFromJsonAsync<JsonElement>();
        var patientId = patient.GetProperty("id").GetGuid();
        patient.GetProperty("clinicId").GetGuid().Should().Be(clinicA.Clinic.Id);

        // ===== Step 2 — Book an appointment; a concurrent double-book fails closed =====
        var slotStart = DateTime.UtcNow.AddDays(1).Date.AddHours(9);
        var booking = await clinicA.AdminClient.PostAsJsonAsync("/api/v1/appointments", new
        {
            patientId,
            clinicianUserId = clinicA.Clinician.Id,
            chairId,
            startAtUtc = slotStart,
            endAtUtc = slotStart.AddMinutes(30),
            reasonForVisit = "Первинний огляд"
        });
        booking.StatusCode.Should().Be(HttpStatusCode.Created);
        var appointment = await booking.Content.ReadFromJsonAsync<AppointmentDto>();

        var doubleBook = await clinicA.AdminClient.PostAsJsonAsync("/api/v1/appointments", new
        {
            patientId,
            clinicianUserId = clinicA.Clinician.Id,
            chairId,
            startAtUtc = slotStart.AddMinutes(15),
            endAtUtc = slotStart.AddMinutes(45),
            reasonForVisit = "Double-book attempt"
        });
        doubleBook.StatusCode.Should().Be(HttpStatusCode.Conflict);

        // ===== Step 3 — The clinician opens the patient record =====
        var patientView = await clinicA.ClinicianClient.GetAsync($"/api/v1/patients/{patientId}");
        patientView.StatusCode.Should().Be(HttpStatusCode.OK);
        (await patientView.Content.ReadFromJsonAsync<JsonElement>())
            .GetProperty("medicalAlerts").GetString().Should().Be("Penicillin allergy");

        // ===== Step 4 — Clinical encounter with the odontogram =====
        var startEncounter = await clinicA.ClinicianClient.PostAsJsonAsync("/api/v1/encounters", new
        {
            patientId,
            appointmentId = appointment!.Id,
            chiefComplaint = "Біль у зубі 16"
        });
        startEncounter.StatusCode.Should().Be(HttpStatusCode.Created);
        var encounter = await startEncounter.Content.ReadFromJsonAsync<JsonElement>();
        var encounterId = encounter.GetProperty("id").GetGuid();
        encounter.GetProperty("appointmentId").GetGuid().Should().Be(appointment.Id);

        const string chartSnapshot = """{"version":"2.22","globals":{},"teeth":{"16":{"toothSelection":"tooth-base","caries":["caries-occlusal"],"cariesSeverity":{"occlusal":3}}}}""";
        var saveChart = await clinicA.ClinicianClient.PutAsJsonAsync($"/api/v1/encounters/{encounterId}/odontogram", new
        {
            snapshotJson = chartSnapshot,
            expectedVersion = 1,
            changeSummary = "Первичный осмотр: каріес 16"
        });
        saveChart.StatusCode.Should().Be(HttpStatusCode.OK);

        // ===== Step 5 — Structured treatment plan with correct estimate =====
        var catalogItem = ProcedureCatalogItem.Create(clinicA.Clinic.Id, "E2E-ENDO", "Ендодонтичне лікування", null, "Ендодонтія", 2500m, 60, DateTime.UtcNow);
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
            db.ProcedureCatalogItems.Add(catalogItem);
            await db.SaveChangesAsync();
        }

        var planCreated = await clinicA.ClinicianClient.PostAsJsonAsync("/api/v1/treatment-plans", new
        {
            patientId,
            sourceEncounterId = encounterId
        });
        planCreated.StatusCode.Should().Be(HttpStatusCode.Created);
        var plan = await planCreated.Content.ReadFromJsonAsync<TreatmentPlanDto>();

        plan = await (await clinicA.ClinicianClient.PostAsJsonAsync($"/api/v1/treatment-plans/{plan!.Id}/items",
            new { catalogItemId = catalogItem.Id, toothFdi = "16", phase = "Етап 1", quantity = 1 })).Content.ReadFromJsonAsync<TreatmentPlanDto>();
        plan!.EstimateTotal.Should().Be(2500m);

        // ===== Step 6 — Approve the plan; record the performed procedure =====
        plan = await (await clinicA.ClinicianClient.PostAsync($"/api/v1/treatment-plans/{plan.Id}/submit", content: null)).Content.ReadFromJsonAsync<TreatmentPlanDto>();
        plan!.Status.Should().Be(TreatmentPlanStatus.Proposed);
        plan = await (await clinicA.ClinicianClient.PostAsync($"/api/v1/treatment-plans/{plan.Id}/approve", content: null)).Content.ReadFromJsonAsync<TreatmentPlanDto>();
        plan!.Status.Should().Be(TreatmentPlanStatus.Approved);

        var procedureRequest = new
        {
            catalogItemId = catalogItem.Id,
            idempotencyKey = "e2e-procedure-1",
            toothFdi = "16",
            quantity = 1,
            treatmentPlanItemId = plan.Items[0].Id,
            clinicalNote = "Виконано під анестезією"
        };
        var recordProcedure = await clinicA.ClinicianClient.PostAsJsonAsync($"/api/v1/encounters/{encounterId}/performed-procedures", procedureRequest);
        recordProcedure.StatusCode.Should().Be(HttpStatusCode.Created);
        var performed = await recordProcedure.Content.ReadFromJsonAsync<JsonElement>();
        performed.GetProperty("totalAmount").GetDecimal().Should().Be(2500m);

        // A retried submission does NOT double-charge (FR-505)
        var retried = await clinicA.ClinicianClient.PostAsJsonAsync($"/api/v1/encounters/{encounterId}/performed-procedures", procedureRequest);
        retried.StatusCode.Should().Be(HttpStatusCode.Created);
        (await retried.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid()
            .Should().Be(performed.GetProperty("id").GetGuid());

        // ===== Step 7 — Invoice over the performed procedure =====
        var invoiceCreated = await clinicA.AdminClient.PostAsJsonAsync($"/api/v1/invoices/from-encounter/{encounterId}", new { });
        invoiceCreated.StatusCode.Should().Be(HttpStatusCode.Created);
        var invoice = await invoiceCreated.Content.ReadFromJsonAsync<InvoiceDto>();
        invoice!.TotalAmount.Should().Be(2500m);
        invoice.IsDemo.Should().BeTrue();

        // ===== Step 8 — Partial then full SIMULATED payment =====
        var partial = await clinicA.AdminClient.PostAsJsonAsync($"/api/v1/invoices/{invoice.Id}/simulated-payments", new
        {
            amount = 1000m,
            methodLabel = "Каса (ДЕМО)",
            idempotencyKey = "e2e-pay-1"
        });
        partial.StatusCode.Should().Be(HttpStatusCode.OK);
        (await partial.Content.ReadFromJsonAsync<InvoiceDto>())!.Status.Should().Be(InvoiceStatus.PartiallySimulated);

        var overpay = await clinicA.AdminClient.PostAsJsonAsync($"/api/v1/invoices/{invoice.Id}/simulated-payments", new
        {
            amount = 5000m,
            methodLabel = "Каса (ДЕМО)",
            idempotencyKey = "e2e-pay-over"
        });
        overpay.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var full = await clinicA.AdminClient.PostAsJsonAsync($"/api/v1/invoices/{invoice.Id}/simulated-payments", new
        {
            amount = 1500m,
            methodLabel = "Каса (ДЕМО)",
            idempotencyKey = "e2e-pay-2"
        });
        (await full.Content.ReadFromJsonAsync<InvoiceDto>())!.Status.Should().Be(InvoiceStatus.FullySimulated);

        // ===== Step 9 — Complete the encounter; clinical data is sealed =====
        var complete = await clinicA.ClinicianClient.PostAsync($"/api/v1/encounters/{encounterId}/complete", content: null);
        complete.StatusCode.Should().Be(HttpStatusCode.OK);

        var sealedEdit = await clinicA.ClinicianClient.PutAsJsonAsync($"/api/v1/encounters/{encounterId}/odontogram", new
        {
            snapshotJson = chartSnapshot,
            expectedVersion = 1
        });
        sealedEdit.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        // ===== Step 10 — Follow-up appointment for the same patient =====
        var followUpStart = slotStart.AddDays(7);
        var followUp = await clinicA.AdminClient.PostAsJsonAsync("/api/v1/appointments", new
        {
            patientId,
            clinicianUserId = clinicA.Clinician.Id,
            chairId,
            startAtUtc = followUpStart,
            endAtUtc = followUpStart.AddMinutes(30),
            reasonForVisit = "Контрольний огляд"
        });
        followUp.StatusCode.Should().Be(HttpStatusCode.Created);
        var followUpDto = await followUp.Content.ReadFromJsonAsync<AppointmentDto>();
        followUpDto!.Id.Should().NotBe(appointment.Id);
        followUpDto.Status.Should().Be(AppointmentStatus.Scheduled);

        // ===== Step 11 — Clinic B isolation: no disclosure of Clinic A data =====
        var foreignPatient = await clinicB.AdminClient.GetAsync($"/api/v1/patients/{patientId}");
        foreignPatient.StatusCode.Should().Be(HttpStatusCode.NotFound);

        var foreignEncounters = await clinicB.AdminClient.GetAsync($"/api/v1/patients/{patientId}/encounters");
        foreignEncounters.StatusCode.Should().Be(HttpStatusCode.NotFound);

        var foreignInvoice = await clinicB.AdminClient.GetAsync($"/api/v1/invoices/{invoice.Id}");
        foreignInvoice.StatusCode.Should().Be(HttpStatusCode.NotFound);

        var foreignChart = await clinicB.AdminClient.GetAsync($"/api/v1/encounters/{encounterId}/odontogram");
        foreignChart.StatusCode.Should().Be(HttpStatusCode.NotFound);

        // ===== Step 12 — Persistence after a "restart": fresh HTTP clients see everything =====
        var freshAdmin = _factory.CreateAuthenticatedClient(clinicA.Admin, clinicA.Clinic.Id, MembershipRole.ClinicAdmin);

        (await freshAdmin.GetAsync($"/api/v1/patients/{patientId}")).StatusCode.Should().Be(HttpStatusCode.OK);
        (await freshAdmin.GetAsync($"/api/v1/encounters/{encounterId}")).StatusCode.Should().Be(HttpStatusCode.OK);
        var chartReload = await freshAdmin.GetAsync($"/api/v1/encounters/{encounterId}/odontogram");
        chartReload.StatusCode.Should().Be(HttpStatusCode.OK);
        var chartJson = JsonSerializer.Deserialize<JsonElement>(
            (await chartReload.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("snapshotJson").GetString()!);
        chartJson.GetProperty("teeth").GetProperty("16").GetProperty("cariesSeverity").GetProperty("occlusal").GetInt32().Should().Be(3);

        var planReload = await freshAdmin.GetFromJsonAsync<TreatmentPlanDto>($"/api/v1/treatment-plans/{plan.Id}");
        planReload!.EstimateTotal.Should().Be(2500m);

        var invoiceReload = await freshAdmin.GetFromJsonAsync<InvoiceDto>($"/api/v1/invoices/{invoice.Id}");
        invoiceReload!.SimulatedPaid.Should().Be(2500m);
        invoiceReload.RemainingBalance.Should().Be(0m);

        var dash = await freshAdmin.GetFromJsonAsync<JsonElement>("/api/v1/dashboard");
        dash.GetProperty("financeIsDemo").GetBoolean().Should().BeTrue();
    }
}
