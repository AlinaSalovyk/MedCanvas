using MediatR;

namespace MedCanvas.Application.Features.Fhir;

public sealed record GetEncounterFhirBundleQuery(Guid EncounterId) : IRequest<string>;
