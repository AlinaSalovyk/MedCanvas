using MedCanvas.Application.Common.Exceptions;
using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace MedCanvas.Application.Features.Clinics;

public sealed class ChangeMemberRoleCommandHandler : IRequestHandler<ChangeMemberRoleCommand, ClinicMemberDto>
{
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IMedCanvasDbContext _dbContext;
    private readonly IDateTimeProvider _dateTimeProvider;

    public ChangeMemberRoleCommandHandler(
        ICurrentUserContext currentUserContext,
        IMedCanvasDbContext dbContext,
        IDateTimeProvider dateTimeProvider)
    {
        _currentUserContext = currentUserContext;
        _dbContext = dbContext;
        _dateTimeProvider = dateTimeProvider;
    }

    public async Task<ClinicMemberDto> Handle(ChangeMemberRoleCommand request, CancellationToken cancellationToken)
    {
        if (!_currentUserContext.IsAuthenticated || _currentUserContext.ClinicId == null || _currentUserContext.UserId == null)
        {
            throw new UnauthorizedAccessException("Request is not authenticated.");
        }

        var clinicId = _currentUserContext.ClinicId.Value;
        var actorUserId = _currentUserContext.UserId.Value;
        var now = _dateTimeProvider.UtcNow;

        if (request.UserId == actorUserId)
        {
            throw new ConflictException("Administrators cannot change their own role.");
        }

        var membership = await MembershipGuards.GetMembershipInCurrentClinicAsync(_dbContext, clinicId, request.UserId, cancellationToken);

        var newRole = Enum.Parse<MembershipRole>(request.Role, ignoreCase: false);
        await MembershipGuards.EnsureNotLastActiveAdminAsync(_dbContext, clinicId, membership, newRole, cancellationToken);

        membership.ChangeRole(newRole, now);

        _dbContext.ClinicalAuditEvents.Add(MedCanvas.Domain.Entities.ClinicalAuditEvent.Create(
            clinicId,
            null,
            null,
            actorUserId,
            "MEMBERSHIP_ROLE_CHANGED",
            null,
            $"user:{request.UserId};to:{newRole}",
            now));

        await _dbContext.SaveChangesAsync(cancellationToken);

        var user = await _dbContext.Users.AsNoTracking().FirstAsync(u => u.Id == request.UserId, cancellationToken);

        return new ClinicMemberDto(user.Id, user.Email, user.FullName, membership.Role.ToString(), membership.IsActive, user.IsActive, membership.CreatedAtUtc);
    }
}
