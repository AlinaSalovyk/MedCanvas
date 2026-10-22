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
}
