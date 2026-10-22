using MediatR;

namespace MedCanvas.Application.Features.Odontograms;

public sealed record FinalizeOdontogramCommand(
    Guid EncounterId,
    int ExpectedVersion) : IRequest<OdontogramResponseDto>;
