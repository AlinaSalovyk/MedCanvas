using MediatR;

namespace MedCanvas.Application.Features.Auth;

public sealed record LoginCommand(
    string Email,
    string Password,
    Guid ClinicId) : IRequest<LoginResponseDto>;
