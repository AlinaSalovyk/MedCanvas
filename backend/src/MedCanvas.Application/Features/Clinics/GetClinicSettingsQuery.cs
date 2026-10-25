using MediatR;

namespace MedCanvas.Application.Features.Clinics;

public sealed record GetClinicSettingsQuery : IRequest<ClinicSettingsDto>;
