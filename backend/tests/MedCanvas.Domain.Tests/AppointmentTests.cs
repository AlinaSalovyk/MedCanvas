using FluentAssertions;
using MedCanvas.Domain.Entities;
using MedCanvas.Domain.Enums;
using MedCanvas.Domain.Exceptions;
using Xunit;

namespace MedCanvas.Domain.Tests;

public class AppointmentTests
{
    private static readonly DateTime Now = new(2026, 10, 26, 8, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime Start = new(2026, 10, 27, 9, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime End = new(2026, 10, 27, 9, 30, 0, DateTimeKind.Utc);

    private static Appointment New() =>
        Appointment.Create(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Start, End, "Checkup", null, Now);

    [Fact]
    public void Create_WithValidSlot_StartsScheduled()
    {
        var a = New();
        a.Status.Should().Be(AppointmentStatus.Scheduled);
        a.ConcurrencyVersion.Should().Be(1);
        a.OccupiesSlot.Should().BeTrue();
    }

    [Fact]
    public void Create_WithEndBeforeStart_ThrowsDomainException()
    {
        var act = () => Appointment.Create(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), End, Start, "Checkup", null, Now);
        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void Create_WithDurationOverEightHours_ThrowsDomainException()
    {
        var act = () => Appointment.Create(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Start, Start.AddHours(9), "Checkup", null, Now);
        act.Should().Throw<DomainException>();
    }

    [Theory]
    [InlineData(DateTimeKind.Unspecified)]
    [InlineData(DateTimeKind.Local)]
    public void Create_WithNonUtcTimes_ThrowsArgumentException(DateTimeKind kind)
    {
        var act = () => Appointment.Create(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            DateTime.SpecifyKind(Start, kind), DateTime.SpecifyKind(End, kind), "Checkup", null, Now);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void HappyLifecycle_ScheduledToCompleted_TransitionsLegally()
    {
        var a = New();
        a.Confirm(Now);
        a.MarkArrived(Now);
        a.StartInProgress(Now);
        a.Complete(Now);

        a.Status.Should().Be(AppointmentStatus.Completed);
        a.OccupiesSlot.Should().BeFalse();
    }

    [Theory]
    [InlineData(AppointmentStatus.Completed)]
    [InlineData(AppointmentStatus.InProgress)]
    [InlineData(AppointmentStatus.Arrived)]
    public void IllegalTransitions_FromScheduled_Throw(AppointmentStatus target)
    {
        var a = New();
        Action act = target switch
        {
            AppointmentStatus.Completed => () => a.Complete(Now),
            AppointmentStatus.InProgress => () => a.StartInProgress(Now),
            AppointmentStatus.Arrived => () => a.MarkArrived(Now),
            _ => throw new Xunit.Sdk.XunitException("unreachable"),
        };
        act.Should().Throw<DomainException>().WithMessage("*Invalid appointment transition*");
    }

    [Fact]
    public void CancelAndNoShow_FromScheduled_AreLegal()
    {
        var cancelled = New();
        cancelled.Cancel("patient asked", Now);
        cancelled.Status.Should().Be(AppointmentStatus.Cancelled);

        var noShow = New();
        noShow.MarkNoShow(Now);
        noShow.Status.Should().Be(AppointmentStatus.NoShow);
    }

    [Fact]
    public void Complete_FromConfirmed_IsIllegal()
    {
        var a = New();
        a.Confirm(Now);
        var act = () => a.Complete(Now);
        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void Cancel_RequiresReason_AndRecordsIt()
    {
        var a = New();
        a.Confirm(Now);
        var act = () => a.Cancel("   ", Now);
        act.Should().Throw<ArgumentException>();

        a.Cancel("Patient unavailable", Now);
        a.Status.Should().Be(AppointmentStatus.Cancelled);
        a.CancellationReason.Should().Be("Patient unavailable");
        a.OccupiesSlot.Should().BeFalse();
    }

    [Fact]
    public void TerminalStates_AreImmutable()
    {
        var a = New();
        a.Cancel("done", Now);
        var act = () => a.Confirm(Now);
        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void Reschedule_FromScheduled_WithMatchingVersion_MovesSlotAndBumpsVersion()
    {
        var a = New();
        var newStart = Start.AddDays(1);
        var newChair = Guid.NewGuid();

        a.Reschedule(newStart, newStart.AddMinutes(45), newChair, expectedVersion: 1, Now);

        a.StartAtUtc.Should().Be(newStart);
        a.ChairId.Should().Be(newChair);
        a.ConcurrencyVersion.Should().Be(2);
        a.Status.Should().Be(AppointmentStatus.Scheduled);
    }

    [Fact]
    public void Reschedule_WithStaleVersion_ThrowsConcurrencyConflict()
    {
        var a = New();
        var act = () => a.Reschedule(Start.AddDays(1), Start.AddDays(1).AddMinutes(30), null, expectedVersion: 5, Now);
        act.Should().Throw<ConcurrencyConflictException>();
    }

    [Fact]
    public void Reschedule_FromArrived_IsIllegal()
    {
        var a = New();
        a.Confirm(Now);
        a.MarkArrived(Now);
        var act = () => a.Reschedule(Start.AddDays(1), Start.AddDays(1).AddMinutes(30), null, expectedVersion: 1, Now);
        act.Should().Throw<DomainException>().WithMessage("*cannot be rescheduled*");
    }
}

public class ClinicChairTests
{
    private static readonly DateTime Now = new(2026, 10, 26, 8, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void Create_SetsNameAndActive()
    {
        var chair = ClinicChair.Create(Guid.NewGuid(), "Chair 1", Now);
        chair.Name.Should().Be("Chair 1");
        chair.IsActive.Should().BeTrue();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Create_WithInvalidName_Throws(string? name)
    {
        var act = () => ClinicChair.Create(Guid.NewGuid(), name!, Now);
        act.Should().Throw<ArgumentException>().WithParameterName("name");
    }

    [Fact]
    public void Rename_AndDeactivateActivate_Work()
    {
        var chair = ClinicChair.Create(Guid.NewGuid(), "Old", Now);
        chair.Rename("New name", Now);
        chair.Name.Should().Be("New name");

        chair.Deactivate(Now);
        chair.IsActive.Should().BeFalse();
        chair.Activate(Now);
        chair.IsActive.Should().BeTrue();
    }
}

public class ProviderAvailabilityTests
{
    private static readonly DateTime Now = new(2026, 10, 26, 8, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void Create_WithValidWindow_Succeeds()
    {
        var av = ProviderAvailability.Create(Guid.NewGuid(), Guid.NewGuid(), 1, new TimeOnly(9, 0), new TimeOnly(18, 0), Now);
        av.DayOfWeek.Should().Be(1);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(8)]
    public void Create_WithInvalidDayOfWeek_Throws(int dayOfWeek)
    {
        var act = () => ProviderAvailability.Create(Guid.NewGuid(), Guid.NewGuid(), dayOfWeek, new TimeOnly(9, 0), new TimeOnly(18, 0), Now);
        act.Should().Throw<ArgumentException>().WithParameterName("dayOfWeek");
    }

    [Fact]
    public void Create_WithEndBeforeStart_Throws()
    {
        var act = () => ProviderAvailability.Create(Guid.NewGuid(), Guid.NewGuid(), 1, new TimeOnly(18, 0), new TimeOnly(9, 0), Now);
        act.Should().Throw<ArgumentException>().WithParameterName("endTime");
    }

    [Fact]
    public void Break_WithEndBeforeStart_Throws()
    {
        var av = ProviderAvailability.Create(Guid.NewGuid(), Guid.NewGuid(), 1, new TimeOnly(9, 0), new TimeOnly(18, 0), Now);
        var act = () => ProviderAvailabilityBreak.Create(av.Id, new TimeOnly(14, 0), new TimeOnly(13, 0), Now);
        act.Should().Throw<ArgumentException>().WithParameterName("endTime");
    }
}
