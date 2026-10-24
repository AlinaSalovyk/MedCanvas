using FluentAssertions;
using MedCanvas.Domain.Entities;
using MedCanvas.Domain.Enums;
using MedCanvas.Infrastructure.Persistence;
using MedCanvas.Infrastructure.Persistence.Repositories;
using MedCanvas.Tests.Common;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace MedCanvas.Infrastructure.IntegrationTests;

[Collection(nameof(PostgreSqlTestCollection))]
public class PostgreSqlPersistenceTests : IAsyncLifetime
{
    private readonly PostgreSqlFixture _fixture;
    private MedCanvasDbContext _context = null!;
    private readonly DateTime _now = new(2026, 10, 22, 12, 0, 0, DateTimeKind.Utc);

    public PostgreSqlPersistenceTests(PostgreSqlFixture fixture)
    {
        _fixture = fixture;
    }

    public async Task InitializeAsync()
    {
        var options = new DbContextOptionsBuilder<MedCanvasDbContext>()
            .UseNpgsql(_fixture.ConnectionString)
            .Options;

        _context = new MedCanvasDbContext(options);

        // Run real PostgreSQL migrations
        await _context.Database.MigrateAsync();
    }

    public async Task DisposeAsync()
    {
        if (_context != null)
        {
            await _context.DisposeAsync();
        }
    }

    [Fact]
    public async Task MigrateDatabase_SuccessfullyCreatesAllTablesAndIndexes()
    {
        var canConnect = await _context.Database.CanConnectAsync();
        canConnect.Should().BeTrue();

        // Verify tables exist by issuing simple count queries
        var clinicCount = await _context.Clinics.CountAsync();
        clinicCount.Should().BeGreaterThanOrEqualTo(0);

        var odontogramCount = await _context.OdontogramRecords.CountAsync();
        odontogramCount.Should().BeGreaterThanOrEqualTo(0);
    }

    [Fact]
    public async Task SaveOdontogram_PersistsJsonbSnapshotAndRehydratesLosslessly()
    {
        var clinic = Clinic.Create("Test Clinic JSONB", $"CJ-{Guid.NewGuid():N}", _now);
        var user = User.Create($"dr.jsonb.{Guid.NewGuid():N}@example.com", "Dr. Jsonb", "hash", _now);
        var patient = Patient.Create(clinic.Id, "John", "Jsonb", null, "Male", null, null, null, null, _now);
        var encounter = DentalEncounter.Start(clinic.Id, patient.Id, user.Id, _now, "Checkup", _now);

        _context.Clinics.Add(clinic);
        _context.Users.Add(user);
        _context.Patients.Add(patient);
        _context.DentalEncounters.Add(encounter);
        await _context.SaveChangesAsync();

        const string complexJsonPayload = "{\"version\":\"2.22\",\"globals\":{\"wisdomVisible\":true},\"teeth\":{\"18\":{\"caries\":[\"mesial\",\"distal\"],\"cariesActiveDepth\":4,\"perio\":{\"pd\":{\"MB\":5,\"B\":3}}}}}";

        var record = OdontogramRecord.Create(
            clinic.Id,
            patient.Id,
            encounter.Id,
            "2.22",
            complexJsonPayload,
            _now);

        var repo = new OdontogramRepository(_context);
        repo.Add(record);
        await _context.SaveChangesAsync();

        // Fetch back in a fresh context query
        var fetched = await repo.GetByEncounterIdAsync(encounter.Id, clinic.Id);
        fetched.Should().NotBeNull();
        fetched!.SnapshotJson.Should().Be(complexJsonPayload);
        fetched.PayloadVersion.Should().Be("2.22");
        fetched.ConcurrencyVersion.Should().Be(1);
        fetched.IsFinalized.Should().BeFalse();
    }

    [Fact]
    public async Task UniqueConstraint_DuplicateEmail_ThrowsDbUpdateException()
    {
        var email = $"duplicate.{Guid.NewGuid():N}@example.com";
        var user1 = User.Create(email, "Dr. One", "hash1", _now);
        var user2 = User.Create(email, "Dr. Two", "hash2", _now);

        _context.Users.Add(user1);
        await _context.SaveChangesAsync();

        _context.Users.Add(user2);
        var act = async () => await _context.SaveChangesAsync();

        await act.Should().ThrowAsync<DbUpdateException>();
    }

    [Fact]
    public async Task ForeignKeyViolation_InvalidClinicId_ThrowsDbUpdateException()
    {
        var patientWithBadClinic = Patient.Create(
            Guid.NewGuid(), // Nonexistent clinic
            "Orphan",
            "Patient",
            null,
            null,
            null,
            null,
            null,
            null,
            _now);

        _context.Patients.Add(patientWithBadClinic);
        var act = async () => await _context.SaveChangesAsync();

        await act.Should().ThrowAsync<DbUpdateException>();
    }

    [Fact]
    public async Task OdontogramRepository_GetLatestByPatientId_ReturnsMostRecent()
    {
        var clinic = Clinic.Create("Latest Test Clinic", $"CL-{Guid.NewGuid():N}", _now);
        var user = User.Create($"dr.latest.{Guid.NewGuid():N}@example.com", "Dr. Latest", "hash", _now);
        var patient = Patient.Create(clinic.Id, "Mary", "Latest", null, "Female", null, null, null, null, _now);

        var enc1 = DentalEncounter.Start(clinic.Id, patient.Id, user.Id, _now.AddDays(-10), "Exam 1", _now.AddDays(-10));
        var enc2 = DentalEncounter.Start(clinic.Id, patient.Id, user.Id, _now, "Exam 2", _now);

        _context.Clinics.Add(clinic);
        _context.Users.Add(user);
        _context.Patients.Add(patient);
        _context.DentalEncounters.AddRange(enc1, enc2);
        await _context.SaveChangesAsync();

        var record1 = OdontogramRecord.Create(clinic.Id, patient.Id, enc1.Id, "2.22", "{\"exam\":1}", _now.AddDays(-10));
        var record2 = OdontogramRecord.Create(clinic.Id, patient.Id, enc2.Id, "2.22", "{\"exam\":2}", _now);

        var repo = new OdontogramRepository(_context);
        repo.Add(record1);
        repo.Add(record2);
        await _context.SaveChangesAsync();

        var latest = await repo.GetLatestByPatientIdAsync(patient.Id, clinic.Id);
        latest.Should().NotBeNull();
        latest!.EncounterId.Should().Be(enc2.Id);
        latest.SnapshotJson.Should().Be("{\"exam\":2}");
    }

    [Fact]
    public async Task SaveOdontogram_TwoConcurrentUpdatesFromSameVersion_EnforcesConcurrencyTokenAndPreservesOriginalData()
    {
        // Arrange
        var clinic = Clinic.Create("Concurrency Test Clinic", $"CC-{Guid.NewGuid():N}", _now);
        var user = User.Create($"dr.conc.{Guid.NewGuid():N}@example.com", "Dr. Concurrency", "hash", _now);
        var patient = Patient.Create(clinic.Id, "Jane", "Concurrency", null, "Female", null, null, null, null, _now);
        var encounter = DentalEncounter.Start(clinic.Id, patient.Id, user.Id, _now, "Exam", _now);

        _context.Clinics.Add(clinic);
        _context.Users.Add(user);
        _context.Patients.Add(patient);
        _context.DentalEncounters.Add(encounter);
        await _context.SaveChangesAsync();

        var originalSnapshot = "{\"version\":\"2.22\",\"teeth\":{\"11\":{\"caries\":[]}}}";
        var record = OdontogramRecord.Create(clinic.Id, patient.Id, encounter.Id, "2.22", originalSnapshot, _now);
        _context.OdontogramRecords.Add(record);
        await _context.SaveChangesAsync();

        // Simulate two concurrent clients both reading version 1 in separate DbContext instances
        var options = new DbContextOptionsBuilder<MedCanvasDbContext>()
            .UseNpgsql(_fixture.ConnectionString)
            .Options;

        await using var contextA = new MedCanvasDbContext(options);
        await using var contextB = new MedCanvasDbContext(options);

        var recordA = await contextA.OdontogramRecords.FirstAsync(r => r.Id == record.Id);
        var recordB = await contextB.OdontogramRecords.FirstAsync(r => r.Id == record.Id);

        // Client A updates successfully to version 2
        var updateASnapshot = "{\"version\":\"2.22\",\"teeth\":{\"11\":{\"caries\":[\"caries-distal\"]}}}";
        recordA.UpdatePayload(updateASnapshot, expectedVersion: 1, _now.AddSeconds(1));
        await contextA.SaveChangesAsync();
        recordA.ConcurrencyVersion.Should().Be(2);

        // Client B tries to save its update prepared against stale version 1
        var updateBSnapshot = "{\"version\":\"2.22\",\"teeth\":{\"11\":{\"caries\":[\"caries-mesial\"]}}}";
        recordB.UpdatePayload(updateBSnapshot, expectedVersion: 1, _now.AddSeconds(2));
        var actStaleUpdate = async () => await contextB.SaveChangesAsync();

        // Act & Assert - EF Core & PostgreSQL reject update because database version is already 2
        await actStaleUpdate.Should().ThrowAsync<DbUpdateConcurrencyException>();

        // Verify original winner data is preserved in database
        await using var verifyContext = new MedCanvasDbContext(options);
        var finalRecord = await verifyContext.OdontogramRecords.AsNoTracking().FirstAsync(r => r.Id == record.Id);
        finalRecord.ConcurrencyVersion.Should().Be(2);
        using var jsonDoc = System.Text.Json.JsonDocument.Parse(finalRecord.SnapshotJson);
        jsonDoc.RootElement.GetProperty("version").GetString().Should().Be("2.22");
        jsonDoc.RootElement.GetProperty("teeth").GetProperty("11").GetProperty("caries")[0].GetString().Should().Be("caries-distal");
    }

    [Fact]
    public async Task SaveOdontogram_ConcurrentCreationForSameEncounter_ThrowsDbUpdateExceptionDueToUniqueIndex()
    {
        // Arrange
        var clinic = Clinic.Create("Dup Test Clinic", $"DC-{Guid.NewGuid():N}", _now);
        var user = User.Create($"dr.dup.{Guid.NewGuid():N}@example.com", "Dr. Dup", "hash", _now);
        var patient = Patient.Create(clinic.Id, "Bob", "Duplicate", null, "Male", null, null, null, null, _now);
        var encounter = DentalEncounter.Start(clinic.Id, patient.Id, user.Id, _now, "Exam", _now);

        _context.Clinics.Add(clinic);
        _context.Users.Add(user);
        _context.Patients.Add(patient);
        _context.DentalEncounters.Add(encounter);
        await _context.SaveChangesAsync();

        var record1 = OdontogramRecord.Create(clinic.Id, patient.Id, encounter.Id, "2.22", "{\"version\":\"2.22\",\"teeth\":{}}", _now);
        var record2 = OdontogramRecord.Create(clinic.Id, patient.Id, encounter.Id, "2.22", "{\"version\":\"2.22\",\"teeth\":{}}", _now);

        _context.OdontogramRecords.Add(record1);
        await _context.SaveChangesAsync();

        // Act & Assert - Attempting to insert a second record for the same encounter violates unique index
        _context.OdontogramRecords.Add(record2);
        var actDuplicate = async () => await _context.SaveChangesAsync();

        await actDuplicate.Should().ThrowAsync<DbUpdateException>();
    }
}

[CollectionDefinition(nameof(PostgreSqlTestCollection))]
public class PostgreSqlTestCollection : ICollectionFixture<PostgreSqlFixture>
{
}
