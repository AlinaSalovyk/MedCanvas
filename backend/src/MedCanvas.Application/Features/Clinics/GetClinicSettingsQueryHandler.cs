using MedCanvas.Application.Common.Exceptions;
using MedCanvas.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace MedCanvas.Application.Features.Clinics;

public sealed class GetClinicSettingsQueryHandler : IRequestHandler<GetClinicSettingsQuery, ClinicSettingsDto>
{
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IMedCanvasDbContext _dbContext;

    public GetClinicSettingsQueryHandler(ICurrentUserContext currentUserContext, IMedCanvasDbContext dbContext)
    {
        _currentUserContext = currentUserContext;
        _dbContext = dbContext;
    }

    public async Task<ClinicSettingsDto> Handle(GetClinicSettingsQuery request, CancellationToken cancellationToken)
    {
        if (!_currentUserContext.IsAuthenticated || _currentUserContext.ClinicId == null)
        {
            throw new UnauthorizedAccessException("Request is not authenticated.");
        }

        var clinic = await _dbContext.Clinics
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == _currentUserContext.ClinicId.Value, cancellationToken);

        if (clinic == null)
        {
            throw new NotFoundException(nameof(Domain.Entities.Clinic), _currentUserContext.ClinicId.Value);
        }

        return new ClinicSettingsDto(clinic.Id, clinic.Name, clinic.Identifier, clinic.TimeZoneId);
    }
}
