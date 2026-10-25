using MediatR;

namespace MedCanvas.Application.Features.Clinics;

/// <summary>Revoke (deactivate) a staff membership. Audit trail preserved; never a physical delete.</summary>
public sealed record RevokeClinicMemberCommand(Guid UserId) : IRequest;
