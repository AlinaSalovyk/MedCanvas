using MedCanvas.Application.Common.Exceptions;
using MedCanvas.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace MedCanvas.Application.Features.Clinics;

public sealed class UpdateClinicSettingsCommandHandler : IRequestHandler<UpdateClinicSettingsCommand, ClinicSettingsDto>
{
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IMedCanvasDbContext _dbContext;
    private readonly IDateTimeProvider _dateTimeProvider;

    public UpdateClinicSettingsCommandHandler(
        ICurrentUserContext currentUserContext,
        IMedCanvasDbContext dbContext,
        IDateTimeProvider dateTimeProvider)
    {
        _currentUserContext = currentUserContext;
        _dbContext = dbContext;
        _dateTimeProvider = dateTimeProvider;
    }

    public async Task<ClinicSettingsDto> Handle(UpdateClinicSettingsCommand request, CancellationToken cancellationToken)
    {
        if (!_currentUserContext.IsAuthenticated || _currentUserContext.ClinicId == null || _currentUserContext.UserId == null)
        {
            throw new UnauthorizedAccessException("Request is not authenticated.");
        }

        var clinicId = _currentUserContext.ClinicId.Value;
        var actorUserId = _currentUserContext.UserId.Value;
        var now = _dateTimeProvider.UtcNow;

        var clinic = await _dbContext.Clinics
            .FirstOrDefaultAsync(c => c.Id == clinicId, cancellationToken);

        if (clinic == null)
        {
            throw new NotFoundException(nameof(Domain.Entities.Clinic), clinicId);
        }

        clinic.UpdateProfile(request.Name, request.TimeZoneId, now);

        _dbContext.ClinicalAuditEvents.Add(MedCanvas.Domain.Entities.ClinicalAuditEvent.Create(
            clinicId,
            null,
            null,
            actorUserId,
            "CLINIC_SETTINGS_UPDATED",
            null,
            $"tz:{clinic.TimeZoneId}",
            now));

        await _dbContext.SaveChangesAsync(cancellationToken);

        return new ClinicSettingsDto(clinic.Id, clinic.Name, clinic.Identifier, clinic.TimeZoneId);
    }
}
