using MedCanvas.Application.Common.Exceptions;
using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace MedCanvas.Application.Features.Patients;

public sealed class ArchivePatientCommandHandler : IRequestHandler<ArchivePatientCommand, PatientDto>
{
    private readonly IMedCanvasDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IDateTimeProvider _dateTimeProvider;

    public ArchivePatientCommandHandler(
        IMedCanvasDbContext dbContext,
        ICurrentUserContext currentUserContext,
        IDateTimeProvider dateTimeProvider)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
        _dateTimeProvider = dateTimeProvider;
    }

    public async Task<PatientDto> Handle(ArchivePatientCommand request, CancellationToken cancellationToken)
    {
        if (!_currentUserContext.IsAuthenticated || _currentUserContext.ClinicId == null || _currentUserContext.UserId == null)
        {
            throw new UnauthorizedAccessException("Authenticated clinic context is required to archive patients.");
        }

        var clinicId = _currentUserContext.ClinicId.Value;
        var actorUserId = _currentUserContext.UserId.Value;
        var now = _dateTimeProvider.UtcNow;

        var patient = await _dbContext.Patients
            .FirstOrDefaultAsync(p => p.Id == request.PatientId && p.ClinicId == clinicId, cancellationToken);
        if (patient == null)
        {
            throw new NotFoundException(nameof(Patient), request.PatientId);
        }

        patient.Archive(now);

        _dbContext.ClinicalAuditEvents.Add(ClinicalAuditEvent.Create(
            clinicId,
            patient.Id,
            null,
            actorUserId,
            "PATIENT_ARCHIVED",
            null,
            $"patient:{patient.Id}",
            now));

        await _dbContext.SaveChangesAsync(cancellationToken);

        return ToDto(patient);
    }

    internal static PatientDto ToDto(Patient patient) => new(
        patient.Id,
        patient.ClinicId,
        patient.FirstName,
        patient.LastName,
        patient.FullName,
        patient.DateOfBirth,
        patient.Gender,
        patient.Phone,
        patient.Email,
        patient.ExternalMedicalRecordNumber,
        patient.MedicalAlerts,
        patient.IsActive,
        patient.ConcurrencyVersion,
        patient.CreatedAtUtc,
        patient.UpdatedAtUtc);
}
