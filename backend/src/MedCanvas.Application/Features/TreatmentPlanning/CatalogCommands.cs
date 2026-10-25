using MediatR;

namespace MedCanvas.Application.Features.TreatmentPlanning;

public sealed record GetCatalogItemsQuery : IRequest<IReadOnlyList<CatalogItemDto>>;

public sealed record CreateCatalogItemCommand(
    string Code,
    string Name,
    string? Description,
    string? Category,
    decimal DefaultPrice,
    int EstimatedDurationMinutes) : IRequest<CatalogItemDto>;

public sealed record UpdateCatalogItemCommand(
    Guid ItemId,
    string Name,
    string? Description,
    string? Category,
    decimal DefaultPrice,
    int EstimatedDurationMinutes) : IRequest<CatalogItemDto>;

public sealed record SetCatalogItemActiveCommand(Guid ItemId, bool Active) : IRequest<CatalogItemDto>;
