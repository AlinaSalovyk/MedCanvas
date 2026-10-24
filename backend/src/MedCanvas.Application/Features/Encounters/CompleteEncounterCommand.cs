using MediatR;

namespace MedCanvas.Application.Features.Encounters;

public sealed record CompleteEncounterCommand(Guid Id, string? ClinicalSummary = null) : IRequest<EncounterDto>;
