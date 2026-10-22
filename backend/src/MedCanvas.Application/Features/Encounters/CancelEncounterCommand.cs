using MediatR;

namespace MedCanvas.Application.Features.Encounters;

public sealed record CancelEncounterCommand(Guid Id, string Reason) : IRequest<EncounterDto>;
