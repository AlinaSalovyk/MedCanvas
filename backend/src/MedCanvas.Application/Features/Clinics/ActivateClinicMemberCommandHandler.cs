using MedCanvas.Application.Common.Exceptions;
using MedCanvas.Application.Common.Interfaces;
using MediatR;

namespace MedCanvas.Application.Features.Clinics;

public sealed class ActivateClinicMemberCommandHandler : IRequestHandler<ActivateClinicMemberCommand>
{
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IMedCanvasDbContext _dbContext;
    private readonly IDateTimeProvider _dateTimeProvider;

    public ActivateClinicMemberCommandHandler(
        ICurrentUserContext currentUserContext,
        IMedCanvasDbContext dbContext,
        IDateTimeProvider dateTimeProvider)
    {
        _currentUserContext = currentUserContext;
        _dbContext = dbContext;
        _dateTimeProvider = dateTimeProvider;
    }

    public async Task Handle(ActivateClinicMemberCommand request, CancellationToken cancellationToken)
    {
        if (!_currentUserContext.IsAuthenticated || _currentUserContext.ClinicId == null || _currentUserContext.UserId == null)
        {
            throw new UnauthorizedAccessException("Request is not authenticated.");
        }

        var clinicId = _currentUserContext.ClinicId.Value;
        var actorUserId = _currentUserContext.UserId.Value;
        var now = _dateTimeProvider.UtcNow;

        var membership = await MembershipGuards.GetMembershipInCurrentClinicAsync(_dbContext, clinicId, request.UserId, cancellationToken);

        membership.Activate(now);

        _dbContext.ClinicalAuditEvents.Add(MedCanvas.Domain.Entities.ClinicalAuditEvent.Create(
            clinicId,
            null,
            null,
            actorUserId,
            "MEMBERSHIP_REACTIVATED",
            null,
            $"user:{request.UserId}",
            now));

        await _dbContext.SaveChangesAsync(cancellationToken);
    }
}
