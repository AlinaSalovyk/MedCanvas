using MediatR;

namespace MedCanvas.Application.Features.Odontograms;

public sealed record GetOdontogramByEncounterQuery(Guid EncounterId) : IRequest<OdontogramResponseDto>;
