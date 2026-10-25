using MediatR;

namespace MedCanvas.Application.Features.Clinics;

/// <summary>Reactivate a previously revoked membership (access restoration with audit).</summary>
public sealed record ActivateClinicMemberCommand(Guid UserId) : IRequest;
