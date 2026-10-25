using MediatR;

namespace MedCanvas.Application.Features.Clinics;

public sealed record GetClinicMembersQuery : IRequest<IReadOnlyList<ClinicMemberDto>>;
