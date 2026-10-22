using MedCanvas.Application.Common.Exceptions;
using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace MedCanvas.Application.Features.Auth;

public sealed class LoginCommandHandler : IRequestHandler<LoginCommand, LoginResponseDto>
{
    private readonly IMedCanvasDbContext _dbContext;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IJwtTokenService _jwtTokenService;

    public LoginCommandHandler(
        IMedCanvasDbContext dbContext,
        IPasswordHasher passwordHasher,
        IJwtTokenService jwtTokenService)
    {
        _dbContext = dbContext;
        _passwordHasher = passwordHasher;
        _jwtTokenService = jwtTokenService;
    }

    public async Task<LoginResponseDto> Handle(LoginCommand request, CancellationToken cancellationToken)
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

        var clinic = await _dbContext.Clinics
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == request.ClinicId, cancellationToken);

        if (clinic == null || !clinic.IsActive)
        {
            throw new NotFoundException(nameof(Clinic), request.ClinicId);
        }

        var membership = await _dbContext.ClinicMemberships
            .AsNoTracking()
            .FirstOrDefaultAsync(m => m.UserId == user.Id && m.ClinicId == request.ClinicId && m.IsActive, cancellationToken);

        if (membership == null)
        {
            throw new ForbiddenAccessException("User has no active membership in the specified clinic.");
        }

        var token = _jwtTokenService.GenerateToken(user, membership);
        var expiresAtUtc = DateTime.UtcNow.AddMinutes(480);

        return new LoginResponseDto(
            Token: token,
            ExpiresAtUtc: expiresAtUtc,
            UserId: user.Id,
            Email: user.Email,
            FullName: user.FullName,
            ClinicId: clinic.Id,
            ClinicName: clinic.Name,
            Role: membership.Role.ToString());
    }
}
