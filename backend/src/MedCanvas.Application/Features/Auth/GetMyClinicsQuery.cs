using MediatR;

namespace MedCanvas.Application.Features.Auth;

public sealed record GetMyClinicsQuery : IRequest<IReadOnlyList<ClinicMembershipSummaryDto>>;
