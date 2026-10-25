using MediatR;

namespace MedCanvas.Application.Features.Clinics;

public sealed record UpdateClinicSettingsCommand(string Name, string TimeZoneId) : IRequest<ClinicSettingsDto>;
