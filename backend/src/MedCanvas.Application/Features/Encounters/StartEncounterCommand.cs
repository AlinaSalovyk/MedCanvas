using MediatR;

namespace MedCanvas.Application.Features.Encounters;

public sealed record StartEncounterCommand(
    Guid PatientId,
    string? ChiefComplaint = null,
    DateTime? EncounterDateUtc = null) : IRequest<EncounterDto>;
