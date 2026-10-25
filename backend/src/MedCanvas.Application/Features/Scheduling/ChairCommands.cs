using MediatR;

namespace MedCanvas.Application.Features.Scheduling;

public sealed record GetChairsQuery : IRequest<IReadOnlyList<ChairDto>>;
public sealed record CreateChairCommand(string Name) : IRequest<ChairDto>;
public sealed record RenameChairCommand(Guid ChairId, string Name) : IRequest<ChairDto>;
public sealed record SetChairActiveCommand(Guid ChairId, bool Active) : IRequest<ChairDto>;
