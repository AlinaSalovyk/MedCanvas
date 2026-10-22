using MediatR;

namespace MedCanvas.Application.Features.Encounters;

public sealed record GetEncounterByIdQuery(Guid Id) : IRequest<EncounterDto>;
