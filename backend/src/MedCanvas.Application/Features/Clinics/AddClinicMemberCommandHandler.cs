using MedCanvas.Application.Common.Exceptions;
using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Domain.Entities;
using MedCanvas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace MedCanvas.Application.Features.Clinics;

public sealed class AddClinicMemberCommandHandler : IRequestHandler<AddClinicMemberCommand, ClinicMemberDto>
{
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IMedCanvasDbContext _dbContext;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IDateTimeProvider _dateTimeProvider;

    public AddClinicMemberCommandHandler(
        ICurrentUserContext currentUserContext,
        IMedCanvasDbContext dbContext,
        IPasswordHasher passwordHasher,
        IDateTimeProvider dateTimeProvider)
    {
        _currentUserContext = currentUserContext;
        _dbContext = dbContext;
        _passwordHasher = passwordHasher;
        _dateTimeProvider = dateTimeProvider;
    }

    public async Task<ClinicMemberDto> Handle(AddClinicMemberCommand request, CancellationToken cancellationToken)
    {
        if (!_currentUserContext.IsAuthenticated || _currentUserContext.ClinicId == null || _currentUserContext.UserId == null)
        {
            throw new UnauthorizedAccessException("Request is not authenticated.");
        }

        var clinicId = _currentUserContext.ClinicId.Value;
        var actorUserId = _currentUserContext.UserId.Value;
        var now = _dateTimeProvider.UtcNow;
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();

        var emailTaken = await _dbContext.Users
            .AsNoTracking()
            .AnyAsync(u => u.Email == normalizedEmail, cancellationToken);
        if (emailTaken)
        {
            throw new ConflictException("A user with this email already exists.");
        }

        var role = Enum.Parse<MembershipRole>(request.Role, ignoreCase: false);

        var user = User.Create(normalizedEmail, request.FullName, _passwordHasher.HashPassword(request.Password), now);
        var membership = ClinicMembership.Create(clinicId, user.Id, role, now);

        _dbContext.Users.Add(user);
        _dbContext.ClinicMemberships.Add(membership);

        _dbContext.ClinicalAuditEvents.Add(ClinicalAuditEvent.Create(
            clinicId,
            null,
            null,
            actorUserId,
            "MEMBERSHIP_CREATED",
            null,
            $"user:{user.Id};role:{role}",
            now));

        await _dbContext.SaveChangesAsync(cancellationToken);

        return new ClinicMemberDto(user.Id, user.Email, user.FullName, role.ToString(), membership.IsActive, user.IsActive, membership.CreatedAtUtc);
    }
}
