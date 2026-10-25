using MediatR;

namespace MedCanvas.Application.Features.Clinics;

public sealed record ChangeMemberRoleCommand(Guid UserId, string Role) : IRequest<ClinicMemberDto>;
