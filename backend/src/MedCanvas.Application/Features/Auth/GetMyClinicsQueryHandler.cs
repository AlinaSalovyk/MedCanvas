using MedCanvas.Application.Common.Exceptions;
using MedCanvas.Application.Common.Interfaces;
using MediatR;

namespace MedCanvas.Application.Features.Auth;

public sealed class GetMyClinicsQueryHandler : IRequestHandler<GetMyClinicsQuery, IReadOnlyList<ClinicMembershipSummaryDto>>
{
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IMedCanvasDbContext _dbContext;

    public GetMyClinicsQueryHandler(ICurrentUserContext currentUserContext, IMedCanvasDbContext dbContext)
    {
        _currentUserContext = currentUserContext;
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyList<ClinicMembershipSummaryDto>> Handle(GetMyClinicsQuery request, CancellationToken cancellationToken)
    {
        if (!_currentUserContext.IsAuthenticated || _currentUserContext.UserId == null)
        {
            throw new UnauthorizedAccessException("Request is not authenticated.");
        }

        var memberships = await MembershipLookups.GetActiveForUserAsync(_dbContext, _currentUserContext.UserId.Value, cancellationToken);

        return memberships.Select(MembershipLookups.ToSummary).ToList();
    }
}
