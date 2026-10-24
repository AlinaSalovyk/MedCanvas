using MedCanvas.Application.Common.Exceptions;
using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace MedCanvas.Application.Features.Auth;

public sealed class SwitchClinicCommandHandler : IRequestHandler<SwitchClinicCommand, LoginResultDto>
{
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IMedCanvasDbContext _dbContext;
    private readonly IJwtTokenService _jwtTokenService;
    private readonly IDateTimeProvider _dateTimeProvider;

    public SwitchClinicCommandHandler(
        ICurrentUserContext currentUserContext,
        IMedCanvasDbContext dbContext,
        IJwtTokenService jwtTokenService,
        IDateTimeProvider dateTimeProvider)
    {
        _currentUserContext = currentUserContext;
        _dbContext = dbContext;
        _jwtTokenService = jwtTokenService;
        _dateTimeProvider = dateTimeProvider;
    }

    public async Task<LoginResultDto> Handle(SwitchClinicCommand request, CancellationToken cancellationToken)
    {
        if (!_currentUserContext.IsAuthenticated || _currentUserContext.UserId == null)
        {
            throw new UnauthorizedAccessException("Request is not authenticated.");
        }

        var userId = _currentUserContext.UserId.Value;

        var user = await _dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId && u.IsActive, cancellationToken);

        if (user == null)
        {
            throw new UnauthorizedAccessException("Account is deactivated.");
        }

        var memberships = await MembershipLookups.GetActiveForUserAsync(_dbContext, userId, cancellationToken);
        var selected = memberships.FirstOrDefault(mc => mc.Clinic.Id == request.ClinicId);

        if (selected == null)
        {
            // Cross-tenant probing must not reveal clinic existence.
            throw new NotFoundException(nameof(Clinic), request.ClinicId);
        }

        var expiresAtUtc = _jwtTokenService.ComputeDefaultExpiry(_dateTimeProvider.UtcNow);
        var token = _jwtTokenService.GenerateToken(user, selected.Clinic.Id, selected.Membership.Role, expiresAtUtc);

        return LoginResultDto.Authenticated(
            token,
            expiresAtUtc,
            user.Id,
            user.Email,
            user.FullName,
            selected.Clinic.Id,
            selected.Clinic.Name,
            selected.Membership.Role.ToString());
    }
}
