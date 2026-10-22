using MediatR;

namespace MedCanvas.Application.Features.Odontograms;

public sealed record GetOdontogramRevisionsQuery(Guid EncounterId) : IRequest<IReadOnlyList<OdontogramRevisionDto>>;
