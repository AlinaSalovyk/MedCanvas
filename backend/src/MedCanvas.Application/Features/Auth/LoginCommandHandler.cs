using MedCanvas.Application.Common.Exceptions;
using MedCanvas.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace MedCanvas.Application.Features.Auth;

public sealed class LoginCommandHandler : IRequestHandler<LoginCommand, LoginResultDto>
{
    private readonly IMedCanvasDbContext _dbContext;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IJwtTokenService _jwtTokenService;
    private readonly IDateTimeProvider _dateTimeProvider;

    public LoginCommandHandler(
        IMedCanvasDbContext dbContext,
        IPasswordHasher passwordHasher,
        IJwtTokenService jwtTokenService,
        IDateTimeProvider dateTimeProvider)
    {
        _dbContext = dbContext;
        _passwordHasher = passwordHasher;
        _jwtTokenService = jwtTokenService;
        _dateTimeProvider = dateTimeProvider;
    }

    public async Task<LoginResultDto> Handle(LoginCommand request, CancellationToken cancellationToken)
    {
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();

        var user = await _dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Email == normalizedEmail, cancellationToken);

        if (user == null || !user.IsActive)
        {
            throw new UnauthorizedAccessException("Invalid credentials or account is deactivated.");
        }

        if (!_passwordHasher.VerifyPassword(request.Password, user.PasswordHash))
        {
            throw new UnauthorizedAccessException("Invalid credentials or account is deactivated.");
        }

        var memberships = await MembershipLookups.GetActiveForUserAsync(_dbContext, user.Id, cancellationToken);

        if (memberships.Count == 0)
        {
            throw new UnauthorizedAccessException("User has no active clinic memberships.");
        }

        MembershipLookups.MembershipWithClinic? selected = null;
        if (request.ClinicId.HasValue)
        {
            selected = memberships.FirstOrDefault(mc => mc.Clinic.Id == request.ClinicId.Value);
            if (selected == null)
            {
                throw new ForbiddenAccessException("User has no active membership in the specified clinic.");
            }
        }
        else if (memberships.Count == 1)
        {
            selected = memberships[0];
        }
        else
        {
            return LoginResultDto.SelectionRequired(memberships.Select(MembershipLookups.ToSummary).ToList());
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
