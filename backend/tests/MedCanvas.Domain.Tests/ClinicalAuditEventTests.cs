using FluentAssertions;
using MedCanvas.Domain.Entities;
using Xunit;

namespace MedCanvas.Domain.Tests;

public class ClinicalAuditEventTests
{
    private readonly DateTime _now = new(2026, 10, 22, 12, 0, 0, DateTimeKind.Utc);
    private readonly Guid _clinicId = Guid.NewGuid();
    private readonly Guid _patientId = Guid.NewGuid();
    private readonly Guid _encounterId = Guid.NewGuid();
    private readonly Guid _actorUserId = Guid.NewGuid();

    [Fact]
    public void Create_WithValidParameters_SetsPropertiesCorrectly()
    {
        var audit = ClinicalAuditEvent.Create(
            _clinicId,
            _patientId,
            _encounterId,
            _actorUserId,
            "OdontogramFinalized",
            "192.168.1.100",
            "hash-sha256-abc",
            _now);

        audit.Id.Should().NotBeEmpty();
        audit.ClinicId.Should().Be(_clinicId);
        audit.PatientId.Should().Be(_patientId);
        audit.EncounterId.Should().Be(_encounterId);
        audit.ActorUserId.Should().Be(_actorUserId);
        audit.Action.Should().Be("OdontogramFinalized");
        audit.ClientIpAddress.Should().Be("192.168.1.100");
        audit.DetailsHash.Should().Be("hash-sha256-abc");
        audit.TimestampUtc.Should().Be(_now);
    }

    [Fact]
    public void Create_WithEmptyClinicId_ThrowsArgumentException()
    {
        var act = () => ClinicalAuditEvent.Create(
            Guid.Empty,
            _patientId,
            _encounterId,
            _actorUserId,
            "Action",
            null,
            null,
            _now);

        act.Should().Throw<ArgumentException>().WithParameterName("clinicId");
    }

    [Fact]
    public void Create_WithEmptyActorUserId_ThrowsArgumentException()
    {
        var act = () => ClinicalAuditEvent.Create(
            _clinicId,
            _patientId,
            _encounterId,
            Guid.Empty,
            "Action",
            null,
            null,
            _now);

        act.Should().Throw<ArgumentException>().WithParameterName("actorUserId");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Create_WithBlankAction_ThrowsArgumentException(string? invalidAction)
    {
        var act = () => ClinicalAuditEvent.Create(
            _clinicId,
            _patientId,
            _encounterId,
            _actorUserId,
            invalidAction!,
            null,
            null,
            _now);

        act.Should().Throw<ArgumentException>().WithParameterName("action");
    }
}
