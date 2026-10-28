using FluentAssertions;
using MedCanvas.Domain.Entities;
using MedCanvas.Domain.Enums;
using MedCanvas.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql;
using Testcontainers.PostgreSql;
using Xunit;

namespace MedCanvas.Infrastructure.IntegrationTests;

public class BillingMigrationTests
{
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Upgrade_PreservesLegacyHistory_AndFailsClosedOnDuplicateActiveInvoices(bool duplicates)
    {
        await using var container = new PostgreSqlBuilder("postgres:16-alpine").Build();
        await container.StartAsync();
        var options = new DbContextOptionsBuilder<MedCanvasDbContext>().UseNpgsql(container.GetConnectionString()).Options;
        await using var db = new MedCanvasDbContext(options);
        var migrator = db.GetService<IMigrator>();
        await migrator.MigrateAsync("20261025130458_AddBilling");
        var now = DateTime.UtcNow;
        var clinic = Clinic.Create("Synthetic", "LEGACY", now);
        var user = User.Create("synthetic@example.test", "Synthetic", "hash", now);
        var patient = Patient.Create(clinic.Id, "Synthetic", "Patient", null, null, null, null, null, null, now);
        var encounter = DentalEncounter.Start(clinic.Id, patient.Id, user.Id, now, "Synthetic", now);
        db.AddRange(clinic, user, patient, encounter);
        await db.SaveChangesAsync();
        var invoiceId = Guid.NewGuid();
        await db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO "Invoices" ("Id", "ClinicId", "PatientId", "EncounterId", "InvoiceNumber", "TotalAmount", "Currency", "Status", "CreatedByUserId", "CreatedAtUtc", "UpdatedAtUtc")
            VALUES ({invoiceId}, {clinic.Id}, {patient.Id}, {encounter.Id}, 'LEGACY-1', 1000.00, 'UAH', 'Issued', {user.Id}, {now}, {now})
            """);
        if (duplicates)
        {
            await db.Database.ExecuteSqlInterpolatedAsync($"""
                INSERT INTO "Invoices" ("Id", "ClinicId", "PatientId", "EncounterId", "InvoiceNumber", "TotalAmount", "Currency", "Status", "CreatedByUserId", "CreatedAtUtc", "UpdatedAtUtc")
                VALUES ({Guid.NewGuid()}, {clinic.Id}, {patient.Id}, {encounter.Id}, 'LEGACY-2', 1000.00, 'UAH', 'Issued', {user.Id}, {now}, {now})
                """);
            var upgrade = () => migrator.MigrateAsync();
            (await upgrade.Should().ThrowAsync<PostgresException>()).Which.SqlState.Should().Be("23505");
            var applied = await db.Database.GetAppliedMigrationsAsync();
            applied.Should().NotContain(m => m.EndsWith("HardenInvoiceSnapshots", StringComparison.Ordinal));
            // The failed migration rolled back; both original financial rows survive.
            var count = await db.Database.SqlQueryRaw<int>("SELECT count(*)::int AS \"Value\" FROM \"Invoices\"").SingleAsync();
            count.Should().Be(2);
        }
        else
        {
            var payment = SimulatedPayment.Record(clinic.Id, invoiceId, 200, "Demo", "legacy-payment", user.Id, now);
            db.SimulatedPayments.Add(payment);
            await db.SaveChangesAsync();
            await migrator.MigrateAsync();
            // Fresh context proves persistent state rather than a tracked in-memory object.
            await using var fresh = new MedCanvasDbContext(options);
            var invoice = await fresh.Invoices.Include(i => i.Payments).SingleAsync();
            invoice.Id.Should().Be(invoiceId);
            invoice.TotalAmount.Should().Be(1000);
            invoice.SimulatedPaid().Should().Be(200);
            invoice.HasLineSnapshot.Should().BeFalse();
            invoice.Items.Should().BeEmpty("historical descriptions cannot be recovered reliably and must not be invented");
        }
    }
}
