namespace MedCanvas.Application.Features.Clinics;

public sealed record ClinicSettingsDto(
    Guid ClinicId,
    string Name,
    string Identifier,
    string TimeZoneId);
