namespace MedCanvas.Application.Features.Auth;

public sealed record LoginResponseDto(
    string Token,
    DateTime ExpiresAtUtc,
    Guid UserId,
    string Email,
    string FullName,
    Guid ClinicId,
    string ClinicName,
    string Role);
