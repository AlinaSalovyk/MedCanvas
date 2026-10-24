using MedCanvas.Application.Common.Exceptions;
using MedCanvas.Application.Common.Interfaces;
using MediatR;

namespace MedCanvas.Application.Features.Clinics;

public sealed class RevokeClinicMemberCommandHandler : IRequestHandler<RevokeClinicMemberCommand>
{
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IMedCanvasDbContext _dbContext;
    private readonly IDateTimeProvider _dateTimeProvider;

    public RevokeClinicMemberCommandHandler(
        ICurrentUserContext currentUserContext,
        IMedCanvasDbContext dbContext,
        IDateTimeProvider dateTimeProvider)
    {
        _currentUserContext = currentUserContext;
        _dbContext = dbContext;
        _dateTimeProvider = dateTimeProvider;
    }

    public async Task Handle(RevokeClinicMemberCommand request, CancellationToken cancellationToken)
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
            throw new ConflictException("Administrators cannot revoke their own membership.");
        }

        var membership = await MembershipGuards.GetMembershipInCurrentClinicAsync(_dbContext, clinicId, request.UserId, cancellationToken);
        await MembershipGuards.EnsureNotLastActiveAdminAsync(_dbContext, clinicId, membership, newRole: null, cancellationToken);

        membership.Deactivate(now);

        _dbContext.ClinicalAuditEvents.Add(MedCanvas.Domain.Entities.ClinicalAuditEvent.Create(
            clinicId,
            null,
            null,
            actorUserId,
            "MEMBERSHIP_REVOKED",
            null,
            $"user:{request.UserId}",
            now));

        await _dbContext.SaveChangesAsync(cancellationToken);
    }
}
