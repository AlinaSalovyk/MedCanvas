using MedCanvas.Application.Common.Exceptions;
using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Domain.Entities;
using MedCanvas.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace MedCanvas.Application.Features.Clinics;

/// <summary>Shared invariants protecting a clinic from locking itself out of administration.</summary>
internal static class MembershipGuards
{
    /// <summary>Fetch the membership for <paramref name="userId"/> in the current clinic, or 404
    /// (cross-clinic member ids must not reveal existence).</summary>
    public static async Task<ClinicMembership> GetMembershipInCurrentClinicAsync(
        IMedCanvasDbContext dbContext,
        Guid clinicId,
        Guid userId,
        CancellationToken cancellationToken)
    {
        var membership = await dbContext.ClinicMemberships
            .FirstOrDefaultAsync(m => m.ClinicId == clinicId && m.UserId == userId, cancellationToken);

        if (membership == null)
        {
            throw new NotFoundException(nameof(ClinicMembership), userId);
        }

        return membership;
    }

    /// <summary>Reject operations that would remove or demote the last active ClinicAdmin of the clinic.</summary>
    public static async Task EnsureNotLastActiveAdminAsync(
        IMedCanvasDbContext dbContext,
        Guid clinicId,
        ClinicMembership targetMembership,
        MembershipRole? newRole,
        CancellationToken cancellationToken)
    {
        if (targetMembership.Role != MembershipRole.ClinicAdmin || !targetMembership.IsActive)
        {
            return;
        }

        if (newRole.HasValue && newRole.Value == MembershipRole.ClinicAdmin)
        {
            return;
        }

        var activeAdminCount = await dbContext.ClinicMemberships
            .AsNoTracking()
            .CountAsync(m => m.ClinicId == clinicId && m.IsActive && m.Role == MembershipRole.ClinicAdmin, cancellationToken);

        if (activeAdminCount <= 1)
        {
            throw new ConflictException("Cannot remove or demote the last active ClinicAdmin of the clinic.");
        }
    }
}
