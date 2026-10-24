using MedCanvas.Application.Common.Exceptions;
using MedCanvas.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace MedCanvas.Application.Features.Clinics;

public sealed class GetClinicMembersQueryHandler : IRequestHandler<GetClinicMembersQuery, IReadOnlyList<ClinicMemberDto>>
{
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IMedCanvasDbContext _dbContext;

    public GetClinicMembersQueryHandler(ICurrentUserContext currentUserContext, IMedCanvasDbContext dbContext)
    {
        _currentUserContext = currentUserContext;
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyList<ClinicMemberDto>> Handle(GetClinicMembersQuery request, CancellationToken cancellationToken)
    {
        if (!_currentUserContext.IsAuthenticated || _currentUserContext.ClinicId == null)
        {
            throw new UnauthorizedAccessException("Request is not authenticated.");
        }

        var clinicId = _currentUserContext.ClinicId.Value;

        var rows = await _dbContext.ClinicMemberships
            .AsNoTracking()
            .Where(m => m.ClinicId == clinicId)
            .Join(_dbContext.Users,
                m => m.UserId,
                u => u.Id,
                (m, u) => new { Membership = m, User = u })
            .OrderByDescending(x => x.Membership.IsActive)
            .ThenBy(x => x.User.FullName)
            .ToListAsync(cancellationToken);

        return rows
            .Select(x => new ClinicMemberDto(
                x.User.Id,
                x.User.Email,
                x.User.FullName,
                x.Membership.Role.ToString(),
                x.Membership.IsActive,
                x.User.IsActive,
                x.Membership.CreatedAtUtc))
            .ToList();
    }
}
