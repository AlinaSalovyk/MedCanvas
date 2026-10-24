using System.Security.Claims;
using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;

namespace MedCanvas.Infrastructure.Security;

/// <summary>
/// Authorization handler verifying that the user has an active membership in the target clinic
/// with an allowed role, and that neither the user, clinic, nor membership has been deactivated.
/// </summary>
public sealed class ActiveClinicMembershipHandler : AuthorizationHandler<ActiveClinicMembershipRequirement>
{
    private readonly IMedCanvasDbContext _dbContext;

    public ActiveClinicMembershipHandler(IMedCanvasDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        ActiveClinicMembershipRequirement requirement)
    {
        if (context.User.Identity?.IsAuthenticated != true)
        {
            return;
        }

        var userIdClaim = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? context.User.FindFirst("sub")?.Value;

        var clinicIdClaim = context.User.FindFirst("clinic_id")?.Value;

        if (!Guid.TryParse(userIdClaim, out var userId) || !Guid.TryParse(clinicIdClaim, out var clinicId))
        {
            return;
        }

        var query = from m in _dbContext.ClinicMemberships.AsNoTracking()
                    where m.UserId == userId && m.ClinicId == clinicId && m.IsActive
                    join u in _dbContext.Users.AsNoTracking() on m.UserId equals u.Id
                    where u.IsActive
                    join c in _dbContext.Clinics.AsNoTracking() on m.ClinicId equals c.Id
                    where c.IsActive
                    select m.Role;

        var role = await query.Cast<MembershipRole?>().FirstOrDefaultAsync();

        if (role == null)
        {
            return; // Inactive or revoked membership fails closed
        }

        if (requirement.AllowedRoles.Count == 0 || requirement.AllowedRoles.Contains(role.Value))
        {
            context.Succeed(requirement);
        }
    }
}
