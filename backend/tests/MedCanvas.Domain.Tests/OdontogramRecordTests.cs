using FluentAssertions;
using MedCanvas.Domain.Entities;
using MedCanvas.Domain.Exceptions;
using Xunit;

namespace MedCanvas.Domain.Tests;

public class OdontogramRecordTests
{
    private readonly DateTime _now = new(2026, 10, 22, 12, 0, 0, DateTimeKind.Utc);
    private readonly Guid _clinicId = Guid.NewGuid();
    private readonly Guid _patientId = Guid.NewGuid();
    private readonly Guid _encounterId = Guid.NewGuid();
    private const string InitialPayload = "{\"version\":\"2.22\",\"teeth\":{}}";

    [Fact]
    public void Create_WithValidParameters_InitializesCorrectly()
    {
        var record = OdontogramRecord.Create(
            _clinicId,
            _patientId,
            _encounterId,
            "2.22",
            InitialPayload,
            _now);

        record.Id.Should().NotBeEmpty();
        record.ClinicId.Should().Be(_clinicId);
        record.PatientId.Should().Be(_patientId);
        record.EncounterId.Should().Be(_encounterId);
        record.PayloadVersion.Should().Be("2.22");
        record.SnapshotJson.Should().Be(InitialPayload);
        record.ConcurrencyVersion.Should().Be(1);
        record.IsFinalized.Should().BeFalse();
        record.FinalizedAtUtc.Should().BeNull();
        record.FinalizedByUserId.Should().BeNull();
        record.CreatedAtUtc.Should().Be(_now);
        record.UpdatedAtUtc.Should().Be(_now);
    }

    [Fact]
    public void Create_WithEmptyGuids_ThrowsArgumentException()
    {
        var act1 = () => OdontogramRecord.Create(Guid.Empty, _patientId, _encounterId, "2.22", InitialPayload, _now);
        act1.Should().Throw<ArgumentException>().WithParameterName("clinicId");

        var act2 = () => OdontogramRecord.Create(_clinicId, Guid.Empty, _encounterId, "2.22", InitialPayload, _now);
        act2.Should().Throw<ArgumentException>().WithParameterName("patientId");

        var act3 = () => OdontogramRecord.Create(_clinicId, _patientId, Guid.Empty, "2.22", InitialPayload, _now);
        act3.Should().Throw<ArgumentException>().WithParameterName("encounterId");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Create_WithBlankSnapshotJson_ThrowsArgumentException(string? invalidJson)
    {
        var act = () => OdontogramRecord.Create(_clinicId, _patientId, _encounterId, "2.22", invalidJson!, _now);
        act.Should().Throw<ArgumentException>().WithParameterName("snapshotJson");
    }

    [Fact]
    public void UpdatePayload_WithMatchingVersion_UpdatesPayloadAndIncrementsVersion()
    {
        var record = OdontogramRecord.Create(_clinicId, _patientId, _encounterId, "2.22", InitialPayload, _now);
        var updatedJson = "{\"version\":\"2.22\",\"teeth\":{\"18\":{\"caries\":[\"mesial\"]}}}";
        var updateTime = _now.AddMinutes(10);

        record.UpdatePayload(updatedJson, expectedVersion: 1, updateTime);

        record.SnapshotJson.Should().Be(updatedJson);
        record.ConcurrencyVersion.Should().Be(2);
        record.UpdatedAtUtc.Should().Be(updateTime);
    }

    [Fact]
    public void UpdatePayload_WithMismatchedVersion_ThrowsConcurrencyConflictException()
    {
        var record = OdontogramRecord.Create(_clinicId, _patientId, _encounterId, "2.22", InitialPayload, _now);

        var act = () => record.UpdatePayload("{\"new\":true}", expectedVersion: 99, _now.AddMinutes(5));

        var ex = act.Should().Throw<ConcurrencyConflictException>().Which;
        ex.AggregateId.Should().Be(record.Id);
        ex.ExpectedVersion.Should().Be(99);
        ex.ActualVersion.Should().Be(1);
    }

    [Fact]
    public void Finalize_WithMatchingVersion_SealsRecordAndIncrementsVersion()
    {
        var record = OdontogramRecord.Create(_clinicId, _patientId, _encounterId, "2.22", InitialPayload, _now);
        var clinicianId = Guid.NewGuid();
        var finalizeTime = _now.AddMinutes(30);

        record.Finalize(clinicianId, expectedVersion: 1, finalizeTime);

        record.IsFinalized.Should().BeTrue();
        record.FinalizedByUserId.Should().Be(clinicianId);
        record.FinalizedAtUtc.Should().Be(finalizeTime);
        record.ConcurrencyVersion.Should().Be(2);
        record.UpdatedAtUtc.Should().Be(finalizeTime);
    }

    [Fact]
    public void Finalize_WithMismatchedVersion_ThrowsConcurrencyConflictException()
    {
        var record = OdontogramRecord.Create(_clinicId, _patientId, _encounterId, "2.22", InitialPayload, _now);

        var act = () => record.Finalize(Guid.NewGuid(), expectedVersion: 5, _now.AddMinutes(10));

        act.Should().Throw<ConcurrencyConflictException>();
    }

    [Fact]
    public void UpdatePayload_WhenFinalized_ThrowsRecordFinalizedException()
    {
        var record = OdontogramRecord.Create(_clinicId, _patientId, _encounterId, "2.22", InitialPayload, _now);
        record.Finalize(Guid.NewGuid(), expectedVersion: 1, _now.AddMinutes(10));

        var act = () => record.UpdatePayload("{\"teeth\":{}}", expectedVersion: 2, _now.AddMinutes(20));

        var ex = act.Should().Throw<RecordFinalizedException>().Which;
        ex.RecordId.Should().Be(record.Id);
    }

    [Fact]
    public void Finalize_WhenAlreadyFinalized_ThrowsRecordFinalizedException()
    {
        var record = OdontogramRecord.Create(_clinicId, _patientId, _encounterId, "2.22", InitialPayload, _now);
        record.Finalize(Guid.NewGuid(), expectedVersion: 1, _now.AddMinutes(10));

        var act = () => record.Finalize(Guid.NewGuid(), expectedVersion: 2, _now.AddMinutes(20));

        act.Should().Throw<RecordFinalizedException>();
    }

    [Fact]
    public void Finalize_WithEmptyUserId_ThrowsArgumentException()
    {
        var record = OdontogramRecord.Create(_clinicId, _patientId, _encounterId, "2.22", InitialPayload, _now);

        var act = () => record.Finalize(Guid.Empty, expectedVersion: 1, _now.AddMinutes(10));

        act.Should().Throw<ArgumentException>().WithParameterName("finalizedByUserId");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Create_WithBlankPayloadVersion_ThrowsArgumentException(string? invalidVersion)
    {
        var act = () => OdontogramRecord.Create(_clinicId, _patientId, _encounterId, invalidVersion!, InitialPayload, _now);

        act.Should().Throw<ArgumentException>().WithParameterName("payloadVersion");
    }

    [Fact]
    public void CreateWithId_RehydratesPersistedStateCorrectly()
    {
        var id = Guid.NewGuid();
        var finalizedBy = Guid.NewGuid();
        var finalizedAt = _now.AddMinutes(15);
        var updatedAt = _now.AddMinutes(20);

        var record = OdontogramRecord.CreateWithId(
            id,
            _clinicId,
            _patientId,
            _encounterId,
            "2.22",
            InitialPayload,
            concurrencyVersion: 5,
            isFinalized: true,
            finalizedAtUtc: finalizedAt,
            finalizedByUserId: finalizedBy,
            createdAtUtc: _now,
            updatedAtUtc: updatedAt);

        record.Id.Should().Be(id);
        record.ClinicId.Should().Be(_clinicId);
        record.PatientId.Should().Be(_patientId);
        record.EncounterId.Should().Be(_encounterId);
        record.PayloadVersion.Should().Be("2.22");
        record.SnapshotJson.Should().Be(InitialPayload);
        record.ConcurrencyVersion.Should().Be(5);
        record.IsFinalized.Should().BeTrue();
        record.FinalizedAtUtc.Should().Be(finalizedAt);
        record.FinalizedByUserId.Should().Be(finalizedBy);
        record.CreatedAtUtc.Should().Be(_now);
        record.UpdatedAtUtc.Should().Be(updatedAt);
    }
}

