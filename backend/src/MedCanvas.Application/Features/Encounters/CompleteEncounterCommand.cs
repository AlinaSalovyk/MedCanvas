using MediatR;

namespace MedCanvas.Application.Features.Encounters;

public sealed record CompleteEncounterCommand(Guid Id) : IRequest<EncounterDto>;
