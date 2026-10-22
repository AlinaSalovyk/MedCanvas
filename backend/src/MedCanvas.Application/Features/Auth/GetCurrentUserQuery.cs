using MediatR;

namespace MedCanvas.Application.Features.Auth;

public sealed record GetCurrentUserQuery : IRequest<CurrentUserDto>;
