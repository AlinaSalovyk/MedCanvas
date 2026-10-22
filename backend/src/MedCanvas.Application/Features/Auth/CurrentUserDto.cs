namespace MedCanvas.Application.Features.Auth;

public sealed record CurrentUserDto(
    Guid UserId,
    string Email,
    string FullName,
    Guid ClinicId,
    string Role,
    bool IsAuthenticated);
