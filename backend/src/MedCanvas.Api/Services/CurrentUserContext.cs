using System.Security.Claims;
using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Domain.Enums;

namespace MedCanvas.Api.Services;

public sealed class CurrentUserContext : ICurrentUserContext
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public CurrentUserContext(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    private ClaimsPrincipal? User => _httpContextAccessor.HttpContext?.User;

    public bool IsAuthenticated => User?.Identity?.IsAuthenticated ?? false;

    public Guid? UserId
    {
        get
        {
            var sub = User?.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? User?.FindFirstValue("sub");

            return Guid.TryParse(sub, out var id) ? id : null;
        }
    }

    public Guid? ClinicId
    {
        get
        {
            var clinicId = User?.FindFirstValue("clinic_id");
            return Guid.TryParse(clinicId, out var id) ? id : null;
        }
    }

    public string? Email => User?.FindFirstValue(ClaimTypes.Email)
        ?? User?.FindFirstValue("email");

    public MembershipRole? Role
    {
        get
        {
            var roleStr = User?.FindFirstValue(ClaimTypes.Role)
                ?? User?.FindFirstValue("role");

            return Enum.TryParse<MembershipRole>(roleStr, true, out var role)
                ? role
                : null;
        }
    }
}
