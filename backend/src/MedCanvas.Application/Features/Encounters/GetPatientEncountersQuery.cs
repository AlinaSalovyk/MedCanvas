using MediatR;

namespace MedCanvas.Application.Features.Encounters;

public sealed record GetPatientEncountersQuery(Guid PatientId) : IRequest<IReadOnlyList<EncounterDto>>;
