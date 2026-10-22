using MediatR;

namespace MedCanvas.Application.Features.Odontograms;

public sealed record SaveOdontogramCommand(
    Guid EncounterId,
    string SnapshotJson,
    int? ExpectedVersion = null,
    string? ChangeSummary = null) : IRequest<OdontogramResponseDto>;
