using MedCanvas.Application.Common.Exceptions;
using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace MedCanvas.Application.Features.Scheduling;

/// <summary>Shared plumbing for appointment lifecycle commands: clinic-scoped fetch,
/// mutation, audit event, save (with exclusion-violation translation), and DTO build.</summary>
internal static class AppointmentTransitions
{
    public static async Task<Appointment> LoadAsync(
        IMedCanvasDbContext dbContext,
        ICurrentUserContext currentUserContext,
        Guid appointmentId,
        CancellationToken cancellationToken)
    {
        if (!currentUserContext.IsAuthenticated || currentUserContext.ClinicId == null || currentUserContext.UserId == null)
        {
            throw new UnauthorizedAccessException("Authenticated clinic context is required.");
        }

        var clinicId = currentUserContext.ClinicId.Value;
        var appointment = await dbContext.Appointments
            .FirstOrDefaultAsync(a => a.Id == appointmentId && a.ClinicId == clinicId, cancellationToken);

        if (appointment == null)
        {
            throw new NotFoundException(nameof(Appointment), appointmentId);
        }

        return appointment;
    }

    public static async Task<AppointmentDto> SaveAndProjectAsync(
        IMedCanvasDbContext dbContext,
        ICurrentUserContext currentUserContext,
        IDbConstraintViolations dbConstraintViolations,
        Appointment appointment,
        string auditAction,
        string auditDetails,
        DateTime now,
        Func<Task> additionalChecks,
        CancellationToken cancellationToken)
    {
        await additionalChecks();

        dbContext.ClinicalAuditEvents.Add(ClinicalAuditEvent.Create(
            appointment.ClinicId,
            appointment.PatientId,
            null,
            currentUserContext.UserId!.Value,
            auditAction,
            null,
            auditDetails,
            now));

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex) when (dbConstraintViolations.IsExclusionViolation(ex))
        {
            throw new ConflictException("The appointment conflicts with another slot after the change.");
        }

        var patientName = await dbContext.Patients
            .AsNoTracking()
            .Where(p => p.Id == appointment.PatientId)
            .Select(p => p.FullName)
            .FirstAsync(cancellationToken);

        var clinicianName = await dbContext.Users
            .AsNoTracking()
            .Where(u => u.Id == appointment.ClinicianUserId)
            .Select(u => u.FullName)
            .FirstAsync(cancellationToken);

        var chairName = await dbContext.ClinicChairs
            .AsNoTracking()
            .Where(c => c.Id == appointment.ChairId)
            .Select(c => c.Name)
            .FirstAsync(cancellationToken);

        return new AppointmentDto(
            appointment.Id,
            appointment.ClinicId,
            appointment.PatientId,
            patientName,
            appointment.ClinicianUserId,
            clinicianName,
            appointment.ChairId,
            chairName,
            appointment.StartAtUtc,
            appointment.EndAtUtc,
            appointment.Status,
            appointment.ReasonForVisit,
            appointment.InternalNote,
            appointment.CancellationReason,
            appointment.ConcurrencyVersion,
            appointment.CreatedAtUtc,
            appointment.UpdatedAtUtc);
    }
}
