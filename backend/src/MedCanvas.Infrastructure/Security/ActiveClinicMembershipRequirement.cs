using MedCanvas.Domain.Enums;
using Microsoft.AspNetCore.Authorization;

namespace MedCanvas.Infrastructure.Security;

/// <summary>
/// Authorization requirement enforcing active clinic membership and role constraints.
/// </summary>
public sealed class ActiveClinicMembershipRequirement : IAuthorizationRequirement
{
    public IReadOnlySet<MembershipRole> AllowedRoles { get; }

    public ActiveClinicMembershipRequirement(params MembershipRole[] allowedRoles)
    {
        AllowedRoles = allowedRoles.ToHashSet();
    }
}
