using FluentAssertions;
using MedCanvas.Domain.Entities;
using MedCanvas.Domain.Enums;
using Xunit;

namespace MedCanvas.Domain.Tests;

public class DentalEncounterTests
{
    private readonly DateTime _now = new(2026, 10, 22, 12, 0, 0, DateTimeKind.Utc);
    private readonly Guid _clinicId = Guid.NewGuid();
    private readonly Guid _patientId = Guid.NewGuid();
    private readonly Guid _attendingUserId = Guid.NewGuid();

    [Fact]
    public void Start_WithValidParameters_InitializesInProgressState()
    {
        var encounter = DentalEncounter.Start(
            _clinicId,
            _patientId,
            _attendingUserId,
            _now,
            "Toothache on lower right",
            _now);

        encounter.Id.Should().NotBeEmpty();
        encounter.ClinicId.Should().Be(_clinicId);
        encounter.PatientId.Should().Be(_patientId);
        encounter.AttendingUserId.Should().Be(_attendingUserId);
        encounter.EncounterDateUtc.Should().Be(_now);
        encounter.ChiefComplaint.Should().Be("Toothache on lower right");
        encounter.Status.Should().Be(EncounterStatus.InProgress);
        encounter.ClinicalNotes.Should().BeNull();
    }

    [Fact]
    public void Start_WithEmptyGuids_ThrowsArgumentException()
    {
        var act1 = () => DentalEncounter.Start(Guid.Empty, _patientId, _attendingUserId, _now, null, _now);
        act1.Should().Throw<ArgumentException>().WithParameterName("clinicId");

        var act2 = () => DentalEncounter.Start(_clinicId, Guid.Empty, _attendingUserId, _now, null, _now);
        act2.Should().Throw<ArgumentException>().WithParameterName("patientId");

        var act3 = () => DentalEncounter.Start(_clinicId, _patientId, Guid.Empty, _now, null, _now);
        act3.Should().Throw<ArgumentException>().WithParameterName("attendingUserId");
    }

    [Fact]
    public void UpdateNotes_WhenInProgress_UpdatesProperties()
    {
        var encounter = DentalEncounter.Start(_clinicId, _patientId, _attendingUserId, _now, "Complaint", _now);
        var updateTime = _now.AddMinutes(15);

        encounter.UpdateNotes("Updated Complaint", "Patient reports sensitivity to cold", updateTime);

        encounter.ChiefComplaint.Should().Be("Updated Complaint");
        encounter.ClinicalNotes.Should().Be("Patient reports sensitivity to cold");
        encounter.UpdatedAtUtc.Should().Be(updateTime);
    }

    [Fact]
    public void Complete_TransitionsStatusToCompleted()
    {
        var encounter = DentalEncounter.Start(_clinicId, _patientId, _attendingUserId, _now, "Complaint", _now);
        var completeTime = _now.AddMinutes(45);

        encounter.Complete(completeTime);

        encounter.Status.Should().Be(EncounterStatus.Completed);
        encounter.UpdatedAtUtc.Should().Be(completeTime);
    }

    [Fact]
    public void Cancel_TransitionsStatusToCancelledAndAppendsReason()
    {
        var encounter = DentalEncounter.Start(_clinicId, _patientId, _attendingUserId, _now, "Complaint", _now);
        encounter.UpdateNotes("Complaint", "Initial notes", _now.AddMinutes(5));

        var cancelTime = _now.AddMinutes(10);
        encounter.Cancel("Patient had to leave for emergency", cancelTime);

        encounter.Status.Should().Be(EncounterStatus.Cancelled);
        encounter.ClinicalNotes.Should().Contain("[CANCELLED: Patient had to leave for emergency]");
        encounter.UpdatedAtUtc.Should().Be(cancelTime);
    }

    [Fact]
    public void Cancel_WithBlankReason_ThrowsArgumentException()
    {
        var encounter = DentalEncounter.Start(_clinicId, _patientId, _attendingUserId, _now, "Complaint", _now);

        var act = () => encounter.Cancel("   ", _now.AddMinutes(5));
        act.Should().Throw<ArgumentException>().WithParameterName("reason");
    }

    [Fact]
    public void UpdateNotes_WhenCompleted_ThrowsInvalidOperationException()
    {
        var encounter = DentalEncounter.Start(_clinicId, _patientId, _attendingUserId, _now, "Complaint", _now);
        encounter.Complete(_now.AddMinutes(30));

        var act = () => encounter.UpdateNotes("New", "Notes", _now.AddMinutes(40));
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*Completed*");
    }

    [Fact]
    public void UpdateNotes_WhenCancelled_ThrowsInvalidOperationException()
    {
        var encounter = DentalEncounter.Start(_clinicId, _patientId, _attendingUserId, _now, "Complaint", _now);
        encounter.Cancel("Patient requested", _now.AddMinutes(10));

        var act = () => encounter.UpdateNotes("New", "Notes", _now.AddMinutes(20));
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*Cancelled*");
    }

    [Fact]
    public void CreateWithId_SetsPropertiesExplicitly()
    {
        var id = Guid.NewGuid();
        var enc = DentalEncounter.CreateWithId(
            id,
            _clinicId,
            _patientId,
            _attendingUserId,
            _now,
            "Chief complaint",
            _now);

        enc.Id.Should().Be(id);
        enc.ClinicId.Should().Be(_clinicId);
        enc.PatientId.Should().Be(_patientId);
        enc.AttendingUserId.Should().Be(_attendingUserId);
        enc.Status.Should().Be(EncounterStatus.InProgress);
    }
}

