using FluentAssertions;
using MedCanvas.Domain.Entities;
using Xunit;

namespace MedCanvas.Domain.Tests;

public class OdontogramRevisionTests
{
    private readonly DateTime _now = new(2026, 10, 22, 12, 0, 0, DateTimeKind.Utc);
    private readonly Guid _clinicId = Guid.NewGuid();
    private readonly Guid _patientId = Guid.NewGuid();
    private readonly Guid _encounterId = Guid.NewGuid();
    private readonly Guid _userId = Guid.NewGuid();

    [Fact]
    public void Create_FromRecord_CopiesPropertiesCorrectly()
    {
        var record = OdontogramRecord.Create(
            _clinicId,
            _patientId,
            _encounterId,
            "2.22",
            "{\"version\":\"2.22\",\"teeth\":{}}",
            _now);

        var revTime = _now.AddMinutes(20);
        var revision = OdontogramRevision.Create(
            record,
            revisionNumber: 1,
            _userId,
            "Initial examination charting",
            revTime);

        revision.Id.Should().NotBeEmpty();
        revision.OdontogramRecordId.Should().Be(record.Id);
        revision.ClinicId.Should().Be(_clinicId);
        revision.PatientId.Should().Be(_patientId);
        revision.EncounterId.Should().Be(_encounterId);
        revision.RevisionNumber.Should().Be(1);
        revision.SnapshotJson.Should().Be(record.SnapshotJson);
        revision.CreatedByUserId.Should().Be(_userId);
        revision.ChangeSummary.Should().Be("Initial examination charting");
        revision.CreatedAtUtc.Should().Be(revTime);
    }

    [Fact]
    public void Create_WithInvalidRevisionNumber_ThrowsArgumentException()
    {
        var record = OdontogramRecord.Create(_clinicId, _patientId, _encounterId, "2.22", "{\"t\":1}", _now);

        var act = () => OdontogramRevision.Create(record, revisionNumber: 0, _userId, "Summary", _now);

        act.Should().Throw<ArgumentException>().WithParameterName("revisionNumber");
    }

    [Fact]
    public void Create_WithNullRecord_ThrowsArgumentNullException()
    {
        var act = () => OdontogramRevision.Create(null!, revisionNumber: 1, _userId, "Summary", _now);

        act.Should().Throw<ArgumentNullException>().WithParameterName("record");
    }

    [Fact]
    public void CreateWithId_SetsPropertiesExplicitly()
    {
        var id = Guid.NewGuid();
        var recordId = Guid.NewGuid();

        var rev = OdontogramRevision.CreateWithId(
            id,
            recordId,
            _clinicId,
            _patientId,
            _encounterId,
            revisionNumber: 3,
            "{\"v\":1}",
            _userId,
            "Revision 3 summary",
            _now);

        rev.Id.Should().Be(id);
        rev.OdontogramRecordId.Should().Be(recordId);
        rev.ClinicId.Should().Be(_clinicId);
        rev.PatientId.Should().Be(_patientId);
        rev.EncounterId.Should().Be(_encounterId);
        rev.RevisionNumber.Should().Be(3);
        rev.SnapshotJson.Should().Be("{\"v\":1}");
        rev.CreatedByUserId.Should().Be(_userId);
        rev.ChangeSummary.Should().Be("Revision 3 summary");
        rev.CreatedAtUtc.Should().Be(_now);
    }

    [Fact]
    public void CreateWithId_WithEmptyGuids_ThrowsArgumentException()
    {
        var act1 = () => OdontogramRevision.CreateWithId(Guid.NewGuid(), Guid.Empty, _clinicId, _patientId, _encounterId, 1, "{}", _userId, null, _now);
        act1.Should().Throw<ArgumentException>().WithParameterName("odontogramRecordId");

        var act2 = () => OdontogramRevision.CreateWithId(Guid.NewGuid(), Guid.NewGuid(), Guid.Empty, _patientId, _encounterId, 1, "{}", _userId, null, _now);
        act2.Should().Throw<ArgumentException>().WithParameterName("clinicId");

        var act3 = () => OdontogramRevision.CreateWithId(Guid.NewGuid(), Guid.NewGuid(), _clinicId, Guid.Empty, _encounterId, 1, "{}", _userId, null, _now);
        act3.Should().Throw<ArgumentException>().WithParameterName("patientId");

        var act4 = () => OdontogramRevision.CreateWithId(Guid.NewGuid(), Guid.NewGuid(), _clinicId, _patientId, Guid.Empty, 1, "{}", _userId, null, _now);
        act4.Should().Throw<ArgumentException>().WithParameterName("encounterId");

        var act5 = () => OdontogramRevision.CreateWithId(Guid.NewGuid(), Guid.NewGuid(), _clinicId, _patientId, _encounterId, 1, "{}", Guid.Empty, null, _now);
        act5.Should().Throw<ArgumentException>().WithParameterName("createdByUserId");

        var act6 = () => OdontogramRevision.CreateWithId(Guid.NewGuid(), Guid.NewGuid(), _clinicId, _patientId, _encounterId, 1, "   ", _userId, null, _now);
        act6.Should().Throw<ArgumentException>().WithParameterName("snapshotJson");
    }
}

