using MedCanvas.Application.Common.Exceptions;
using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace MedCanvas.Application.Features.Dashboard;

/// <summary>
/// FR-704: minimal operational dashboard from REAL application data only —
/// counters and sums are computed by the database, tenant- and role-scoped.
/// Finance figures are DEMO simulated amounts and are labeled as such (INV-008).
/// </summary>
public sealed class GetClinicDashboardQueryHandler : IRequestHandler<GetClinicDashboardQuery, ClinicDashboardDto>
{
    private readonly IMedCanvasDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;

    public GetClinicDashboardQueryHandler(IMedCanvasDbContext dbContext, ICurrentUserContext currentUserContext)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
    }

    public async Task<ClinicDashboardDto> Handle(GetClinicDashboardQuery request, CancellationToken cancellationToken)
    {
        if (!_currentUserContext.IsAuthenticated || _currentUserContext.ClinicId == null)
        {
            throw new UnauthorizedAccessException("Authenticated clinic context is required.");
        }

        var clinicId = _currentUserContext.ClinicId.Value;

        // Clinicians see their own schedule; admins see the whole clinic (FR-705).
        var isClinicianScoped = _currentUserContext.Role == MembershipRole.Clinician
            && _currentUserContext.UserId != null;

        var clinic = await _dbContext.Clinics
            .AsNoTracking()
            .FirstAsync(c => c.Id == clinicId, cancellationToken);
        var timeZone = TimeZoneInfo.FindSystemTimeZoneById(clinic.TimeZoneId);

        var nowUtc = DateTime.UtcNow;
        var localToday = TimeZoneInfo.ConvertTimeFromUtc(nowUtc, timeZone).Date;
        var dayStartUtc = TimeZoneInfo.ConvertTimeToUtc(localToday, timeZone);
        var dayEndUtc = dayStartUtc.AddDays(1);
        var weekEndUtc = dayEndUtc.AddDays(7);

        var appointmentsQuery = _dbContext.Appointments
            .AsNoTracking()
            .Where(a => a.ClinicId == clinicId);
        if (isClinicianScoped)
        {
            appointmentsQuery = appointmentsQuery.Where(a => a.ClinicianUserId == _currentUserContext.UserId!.Value);
        }

        var todaysAppointments = await appointmentsQuery
            .CountAsync(a => a.StartAtUtc < dayEndUtc && a.EndAtUtc > dayStartUtc, cancellationToken);

        var waiting = await appointmentsQuery
            .CountAsync(a => a.StartAtUtc < dayEndUtc && a.EndAtUtc > dayStartUtc
                             && (a.Status == AppointmentStatus.Confirmed || a.Status == AppointmentStatus.Arrived),
                cancellationToken);

        var completedToday = await appointmentsQuery
            .CountAsync(a => a.StartAtUtc < dayEndUtc && a.EndAtUtc > dayStartUtc
                             && a.Status == AppointmentStatus.Completed, cancellationToken);

        var upcoming = await appointmentsQuery
            .CountAsync(a => a.StartAtUtc >= dayEndUtc && a.StartAtUtc < weekEndUtc
                             && (a.Status == AppointmentStatus.Scheduled
                                 || a.Status == AppointmentStatus.Confirmed
                                 || a.Status == AppointmentStatus.Arrived
                                 || a.Status == AppointmentStatus.InProgress),
                cancellationToken);

        var encountersQuery = _dbContext.DentalEncounters
            .AsNoTracking()
            .Where(e => e.ClinicId == clinicId);
        if (isClinicianScoped)
        {
            encountersQuery = encountersQuery.Where(e => e.AttendingUserId == _currentUserContext.UserId!.Value);
        }

        var inProgressEncounters = await encountersQuery
            .CountAsync(e => e.Status == EncounterStatus.InProgress, cancellationToken);

        var invoicesQuery = _dbContext.Invoices
            .AsNoTracking()
            .Where(i => i.ClinicId == clinicId);
        if (isClinicianScoped)
        {
            invoicesQuery = invoicesQuery.Where(i => i.CreatedByUserId == _currentUserContext.UserId!.Value);
        }

        var invoicesIssuedToday = await invoicesQuery
            .CountAsync(i => i.CreatedAtUtc >= dayStartUtc && i.CreatedAtUtc < dayEndUtc, cancellationToken);

        var simulatedToday = await _dbContext.SimulatedPayments
            .AsNoTracking()
            .Where(p => p.ClinicId == clinicId &&
                        p.Status == SimulatedPaymentStatus.Recorded &&
                        p.CreatedAtUtc >= dayStartUtc && p.CreatedAtUtc < dayEndUtc)
            .SumAsync(p => (decimal?)p.Amount, cancellationToken) ?? 0m;

        return new ClinicDashboardDto(
            todaysAppointments,
            waiting,
            inProgressEncounters,
            completedToday,
            upcoming,
            invoicesIssuedToday,
            simulatedToday,
            FinanceIsDemo: true);
    }
}
