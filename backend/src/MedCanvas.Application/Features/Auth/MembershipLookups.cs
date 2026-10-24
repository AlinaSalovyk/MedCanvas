using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace MedCanvas.Application.Features.Auth;

/// <summary>Shared read helpers for active clinic memberships (login picker, switcher).</summary>
internal static class MembershipLookups
{
    public sealed record MembershipWithClinic(ClinicMembership Membership, Clinic Clinic);

    public static async Task<List<MembershipWithClinic>> GetActiveForUserAsync(
        IMedCanvasDbContext dbContext,
        Guid userId,
        CancellationToken cancellationToken)
    {
        var rows = await dbContext.ClinicMemberships
            .AsNoTracking()
            .Where(m => m.UserId == userId && m.IsActive)
            .Join(dbContext.Clinics.Where(c => c.IsActive),
                m => m.ClinicId,
                c => c.Id,
                (m, c) => new { Membership = m, Clinic = c })
            .OrderBy(x => x.Clinic.Name)
            .ToListAsync(cancellationToken);

        return rows.Select(x => new MembershipWithClinic(x.Membership, x.Clinic)).ToList();
    }

    public static ClinicMembershipSummaryDto ToSummary(MembershipWithClinic mc) =>
        new(mc.Clinic.Id, mc.Clinic.Name, mc.Clinic.Identifier, mc.Membership.Role.ToString());
}
