using MedCanvas.Application.Common.Exceptions;
using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Domain.Entities;
using MedCanvas.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace MedCanvas.Application.Features.Scheduling;

/// <summary>Shared scheduling invariants: overlap detection, availability windows, and
/// PostgreSQL exclusion-violation translation.</summary>
internal static class SchedulingGuards
{
    public static async Task EnsureAvailabilityEditorAsync(IMedCanvasDbContext dbContext,
        ICurrentUserContext actor, Guid clinicianUserId, CancellationToken cancellationToken)
    {
        var member = await dbContext.ClinicMemberships.AsNoTracking().AnyAsync(m =>
            m.ClinicId == actor.ClinicId && m.UserId == clinicianUserId && m.IsActive &&
            (m.Role == MembershipRole.Clinician || m.Role == MembershipRole.ClinicAdmin), cancellationToken);
        if (!member) throw new NotFoundException(nameof(ClinicMembership), clinicianUserId);
        if (actor.Role != MembershipRole.ClinicAdmin && actor.UserId != clinicianUserId)
            throw new ForbiddenAccessException("Only the clinician or a clinic administrator can edit this availability.");
    }

    public const string ExclusionViolationSqlState = "23P01";

    /// <summary>Friendly pre-check (the database EXCLUDE constraint is the hard guarantee).</summary>
    public static async Task EnsureNoOverlapAsync(
        IMedCanvasDbContext dbContext,
        Guid clinicId,
        Guid clinicianUserId,
        Guid chairId,
        DateTime startUtc,
        DateTime endUtc,
        Guid? ignoreAppointmentId,
        CancellationToken cancellationToken)
    {
        var overlaps = await dbContext.Appointments
            .AsNoTracking()
            .AnyAsync(a =>
                a.ClinicId == clinicId &&
                a.Id != ignoreAppointmentId &&
                a.Status != AppointmentStatus.Cancelled &&
                a.Status != AppointmentStatus.NoShow &&
                a.StartAtUtc < endUtc &&
                a.EndAtUtc > startUtc &&
                (a.ClinicianUserId == clinicianUserId || a.ChairId == chairId),
                cancellationToken);

        if (overlaps)
        {
            throw new ConflictException("The selected time slot conflicts with another appointment for this clinician or chair.");
        }
    }

    /// <summary>Validate the slot fits the clinician's weekly availability (clinic-local time,
    /// breaks subtracted, dated exceptions honored). Requires at least one working window.</summary>
    public static async Task EnsureWithinAvailabilityAsync(
        IMedCanvasDbContext dbContext,
        Guid clinicId,
        Guid clinicianUserId,
        string clinicTimeZoneId,
        DateTime startUtc,
        DateTime endUtc,
        CancellationToken cancellationToken)
    {
        var windows = await dbContext.ProviderAvailabilities
            .AsNoTracking()
            .Where(a => a.ClinicId == clinicId && a.ClinicianUserId == clinicianUserId)
            .Join(dbContext.ProviderAvailabilityBreaks,
                a => a.Id,
                b => b.ProviderAvailabilityId,
                (a, b) => new { Window = a, Break = b })
            .ToListAsync(cancellationToken);

        var plainWindows = await dbContext.ProviderAvailabilities
            .AsNoTracking()
            .Where(a => a.ClinicId == clinicId && a.ClinicianUserId == clinicianUserId)
            .ToListAsync(cancellationToken);

        var exceptions = await dbContext.ProviderAvailabilityExceptions
            .AsNoTracking()
            .Where(e => e.ClinicId == clinicId && e.ClinicianUserId == clinicianUserId)
            .ToListAsync(cancellationToken);

        var timeZone = TimeZoneInfo.FindSystemTimeZoneById(clinicTimeZoneId);
        var localStart = TimeZoneInfo.ConvertTimeFromUtc(startUtc, timeZone);
        var localEnd = TimeZoneInfo.ConvertTimeFromUtc(endUtc, timeZone);

        // A working window uses wall-clock times. Reject ambiguous repeated times
        // and intervals crossing an offset change rather than guessing availability.
        if (timeZone.IsAmbiguousTime(localStart) || timeZone.IsAmbiguousTime(localEnd) ||
            timeZone.GetUtcOffset(startUtc) != timeZone.GetUtcOffset(endUtc))
        {
            throw new Domain.Exceptions.DomainException("Appointment must use an unambiguous interval outside a daylight-saving transition.");
        }

        // A slot must sit inside a single calendar day in clinic-local time.
        if (localStart.Date != localEnd.Date || localEnd <= localStart)
        {
            throw new Domain.Exceptions.DomainException("Appointment must start and end within one clinic-local calendar day.");
        }

        var localDate = DateOnly.FromDateTime(localStart);
        var dateException = exceptions.FirstOrDefault(e => e.Date == localDate);
        if (dateException != null && !dateException.IsWorkingDay)
        {
            throw new Domain.Exceptions.DomainException("The clinician does not work on the selected date (day off).");
        }

        // A boolean working-day exception has no interval of its own. It never
        // grants unrestricted hours: an explicit weekly window and its breaks
        // still apply. Extra working days require configuring a weekly window.
        if (plainWindows.Count == 0)
        {
            throw new Domain.Exceptions.DomainException("The clinician has no configured working hours.");
        }
        {
            // ISO day of week: Monday=1 … Sunday=7
            var dayOfWeek = ((int)localStart.DayOfWeek + 6) % 7 + 1;
            var dayWindows = plainWindows.Where(w => w.DayOfWeek == dayOfWeek).ToList();
            if (dayWindows.Count == 0)
            {
                throw new Domain.Exceptions.DomainException("The clinician has no working hours on the selected weekday.");
            }

            var start = TimeOnly.FromDateTime(localStart);
            var end = TimeOnly.FromDateTime(localEnd);

            var fits = dayWindows.Any(w =>
            {
                if (start < w.StartTime || end > w.EndTime)
                {
                    return false;
                }

                var dayBreaks = windows
                    .Where(r => r.Window.Id == w.Id)
                    .Select(r => (r.Break.StartTime, r.Break.EndTime))
                    .ToList();

                // The slot must not intersect any break.
                return dayBreaks.All(b => end <= b.StartTime || start >= b.EndTime);
            });

            if (!fits)
            {
                throw new Domain.Exceptions.DomainException("The selected time is outside the clinician's working hours or overlaps a break.");
            }
        }
    }
}
