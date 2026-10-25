using MedCanvas.Application.Common.Exceptions;
using MedCanvas.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace MedCanvas.Application.Features.Scheduling;

public sealed class GetAppointmentsQueryHandler : IRequestHandler<GetAppointmentsQuery, IReadOnlyList<AppointmentDto>>
{
    private readonly IMedCanvasDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;

    public GetAppointmentsQueryHandler(IMedCanvasDbContext dbContext, ICurrentUserContext currentUserContext)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
    }

    public async Task<IReadOnlyList<AppointmentDto>> Handle(GetAppointmentsQuery request, CancellationToken cancellationToken)
    {
        if (!_currentUserContext.IsAuthenticated || _currentUserContext.ClinicId == null)
        {
            throw new UnauthorizedAccessException("Authenticated clinic context is required to view the calendar.");
        }

        if (request.FromUtc.Kind != DateTimeKind.Utc || request.ToUtc.Kind != DateTimeKind.Utc)
        {
            throw new Domain.Exceptions.DomainException("Calendar window bounds must be specified in UTC.");
        }

        if (request.ToUtc <= request.FromUtc || request.ToUtc - request.FromUtc > TimeSpan.FromDays(62))
        {
            throw new Domain.Exceptions.DomainException("Calendar window must be a positive range of at most 62 days.");
        }

        var clinicId = _currentUserContext.ClinicId.Value;

        var rows = await _dbContext.Appointments
            .AsNoTracking()
            .Where(a => a.ClinicId == clinicId &&
                        a.StartAtUtc < request.ToUtc &&
                        a.EndAtUtc > request.FromUtc)
            .Where(a => request.ClinicianUserId == null || a.ClinicianUserId == request.ClinicianUserId)
            .Where(a => request.ChairId == null || a.ChairId == request.ChairId)
            .Where(a => request.Status == null || a.Status == request.Status)
            .Join(_dbContext.Patients,
                a => a.PatientId,
                p => p.Id,
                (a, p) => new { Appointment = a, PatientName = p.FullName })
            .Join(_dbContext.Users,
                r => r.Appointment.ClinicianUserId,
                u => u.Id,
                (r, u) => new { r.Appointment, r.PatientName, ClinicianName = u.FullName })
            .Join(_dbContext.ClinicChairs,
                r => r.Appointment.ChairId,
                c => c.Id,
                (r, c) => new { r.Appointment, r.PatientName, r.ClinicianName, ChairName = c.Name })
            .OrderBy(r => r.Appointment.StartAtUtc)
            .ToListAsync(cancellationToken);

        return rows
            .Select(r => new AppointmentDto(
                r.Appointment.Id,
                r.Appointment.ClinicId,
                r.Appointment.PatientId,
                r.PatientName,
                r.Appointment.ClinicianUserId,
                r.ClinicianName,
                r.Appointment.ChairId,
                r.ChairName,
                r.Appointment.StartAtUtc,
                r.Appointment.EndAtUtc,
                r.Appointment.Status,
                r.Appointment.ReasonForVisit,
                r.Appointment.InternalNote,
                r.Appointment.CancellationReason,
                r.Appointment.ConcurrencyVersion,
                r.Appointment.CreatedAtUtc,
                r.Appointment.UpdatedAtUtc))
            .ToList();
    }
}
