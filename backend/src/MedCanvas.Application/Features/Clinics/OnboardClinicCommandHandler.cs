using MedCanvas.Application.Common.Exceptions;
using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Application.Features.Auth;
using MedCanvas.Domain.Entities;
using MedCanvas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace MedCanvas.Application.Features.Clinics;

public sealed class OnboardClinicCommandHandler : IRequestHandler<OnboardClinicCommand, LoginResultDto>
{
    private readonly IMedCanvasDbContext _dbContext;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IJwtTokenService _jwtTokenService;
    private readonly IDateTimeProvider _dateTimeProvider;

    public OnboardClinicCommandHandler(
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

    public async Task<LoginResultDto> Handle(OnboardClinicCommand request, CancellationToken cancellationToken)
    {
        var now = _dateTimeProvider.UtcNow;
        var normalizedEmail = request.AdminEmail.Trim().ToLowerInvariant();
        var normalizedIdentifier = request.ClinicIdentifier.Trim().ToUpperInvariant();

        var emailTaken = await _dbContext.Users
            .AsNoTracking()
            .AnyAsync(u => u.Email == normalizedEmail, cancellationToken);
        if (emailTaken)
        {
            throw new ConflictException("A user with this email already exists. Clinic onboarding requires a brand-new administrator account.");
        }

        var identifierTaken = await _dbContext.Clinics
            .AsNoTracking()
            .AnyAsync(c => c.Identifier == normalizedIdentifier, cancellationToken);
        if (identifierTaken)
        {
            throw new ConflictException("A clinic with this identifier already exists.");
        }

        var clinic = Clinic.Create(request.ClinicName, normalizedIdentifier, now, request.TimeZoneId);
        var user = User.Create(normalizedEmail, request.AdminFullName, _passwordHasher.HashPassword(request.AdminPassword), now);
        var membership = ClinicMembership.Create(clinic.Id, user.Id, MembershipRole.ClinicAdmin, now);

        _dbContext.Clinics.Add(clinic);
        _dbContext.Users.Add(user);
        _dbContext.ClinicMemberships.Add(membership);

        _dbContext.ClinicalAuditEvents.Add(ClinicalAuditEvent.Create(
            clinic.Id,
            null,
            null,
            user.Id,
            "CLINIC_ONBOARDED",
            null,
            $"clinic:{normalizedIdentifier}",
            now));

        await _dbContext.SaveChangesAsync(cancellationToken);

        var expiresAtUtc = _jwtTokenService.ComputeDefaultExpiry(now);
        var token = _jwtTokenService.GenerateToken(user, clinic.Id, membership.Role, expiresAtUtc);

        return LoginResultDto.Authenticated(
            token,
            expiresAtUtc,
            user.Id,
            user.Email,
            user.FullName,
            clinic.Id,
            clinic.Name,
            membership.Role.ToString());
    }
}
