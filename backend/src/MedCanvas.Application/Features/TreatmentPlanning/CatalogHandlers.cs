using FluentValidation;
using MedCanvas.Application.Common.Exceptions;
using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace MedCanvas.Application.Features.TreatmentPlanning;

public sealed class GetCatalogItemsQueryHandler : IRequestHandler<GetCatalogItemsQuery, IReadOnlyList<CatalogItemDto>>
{
    private readonly IMedCanvasDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;

    public GetCatalogItemsQueryHandler(IMedCanvasDbContext dbContext, ICurrentUserContext currentUserContext)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
    }

    public async Task<IReadOnlyList<CatalogItemDto>> Handle(GetCatalogItemsQuery request, CancellationToken cancellationToken)
    {
        if (!_currentUserContext.IsAuthenticated || _currentUserContext.ClinicId == null)
        {
            throw new UnauthorizedAccessException("Authenticated clinic context is required.");
        }

        return await _dbContext.ProcedureCatalogItems
            .AsNoTracking()
            .Where(i => i.ClinicId == _currentUserContext.ClinicId.Value)
            .OrderBy(i => i.Category)
            .ThenBy(i => i.Name)
            .Select(i => new CatalogItemDto(i.Id, i.ClinicId, i.Code, i.Name, i.Description, i.Category, i.DefaultPrice, i.EstimatedDurationMinutes, i.IsActive))
            .ToListAsync(cancellationToken);
    }
}

public sealed class CreateCatalogItemCommandHandler : IRequestHandler<CreateCatalogItemCommand, CatalogItemDto>
{
    private readonly IMedCanvasDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IDateTimeProvider _dateTimeProvider;

    public CreateCatalogItemCommandHandler(IMedCanvasDbContext dbContext, ICurrentUserContext currentUserContext, IDateTimeProvider dateTimeProvider)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
        _dateTimeProvider = dateTimeProvider;
    }

    public async Task<CatalogItemDto> Handle(CreateCatalogItemCommand request, CancellationToken cancellationToken)
    {
        if (!_currentUserContext.IsAuthenticated || _currentUserContext.ClinicId == null || _currentUserContext.UserId == null)
        {
            throw new UnauthorizedAccessException("Authenticated clinic context is required.");
        }

        var clinicId = _currentUserContext.ClinicId.Value;
        var code = request.Code.Trim().ToUpperInvariant();

        var codeTaken = await _dbContext.ProcedureCatalogItems
            .AsNoTracking()
            .AnyAsync(i => i.ClinicId == clinicId && i.Code == code, cancellationToken);
        if (codeTaken)
        {
            throw new ConflictException("A catalog item with this code already exists in the clinic.");
        }

        var item = ProcedureCatalogItem.Create(
            clinicId, code, request.Name, request.Description, request.Category,
            request.DefaultPrice, request.EstimatedDurationMinutes, _dateTimeProvider.UtcNow);

        _dbContext.ProcedureCatalogItems.Add(item);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new CatalogItemDto(item.Id, item.ClinicId, item.Code, item.Name, item.Description, item.Category, item.DefaultPrice, item.EstimatedDurationMinutes, item.IsActive);
    }
}

public sealed class UpdateCatalogItemCommandHandler : IRequestHandler<UpdateCatalogItemCommand, CatalogItemDto>
{
    private readonly IMedCanvasDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IDateTimeProvider _dateTimeProvider;

    public UpdateCatalogItemCommandHandler(IMedCanvasDbContext dbContext, ICurrentUserContext currentUserContext, IDateTimeProvider dateTimeProvider)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
        _dateTimeProvider = dateTimeProvider;
    }

    public async Task<CatalogItemDto> Handle(UpdateCatalogItemCommand request, CancellationToken cancellationToken)
    {
        var item = await LoadItemAsync(_dbContext, _currentUserContext, request.ItemId, cancellationToken);
        item.Update(request.Name, request.Description, request.Category, request.DefaultPrice, request.EstimatedDurationMinutes, _dateTimeProvider.UtcNow);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return new CatalogItemDto(item.Id, item.ClinicId, item.Code, item.Name, item.Description, item.Category, item.DefaultPrice, item.EstimatedDurationMinutes, item.IsActive);
    }

    internal static async Task<ProcedureCatalogItem> LoadItemAsync(
        IMedCanvasDbContext dbContext, ICurrentUserContext currentUserContext, Guid itemId, CancellationToken cancellationToken)
    {
        if (!currentUserContext.IsAuthenticated || currentUserContext.ClinicId == null || currentUserContext.UserId == null)
        {
            throw new UnauthorizedAccessException("Authenticated clinic context is required.");
        }

        var item = await dbContext.ProcedureCatalogItems
            .FirstOrDefaultAsync(i => i.Id == itemId && i.ClinicId == currentUserContext.ClinicId.Value, cancellationToken);

        if (item == null)
        {
            throw new NotFoundException(nameof(ProcedureCatalogItem), itemId);
        }

        return item;
    }
}

public sealed class SetCatalogItemActiveCommandHandler : IRequestHandler<SetCatalogItemActiveCommand, CatalogItemDto>
{
    private readonly IMedCanvasDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IDateTimeProvider _dateTimeProvider;

    public SetCatalogItemActiveCommandHandler(IMedCanvasDbContext dbContext, ICurrentUserContext currentUserContext, IDateTimeProvider dateTimeProvider)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
        _dateTimeProvider = dateTimeProvider;
    }

    public async Task<CatalogItemDto> Handle(SetCatalogItemActiveCommand request, CancellationToken cancellationToken)
    {
        var item = await UpdateCatalogItemCommandHandler.LoadItemAsync(_dbContext, _currentUserContext, request.ItemId, cancellationToken);
        if (request.Active)
        {
            item.Activate(_dateTimeProvider.UtcNow);
        }
        else
        {
            item.Deactivate(_dateTimeProvider.UtcNow);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return new CatalogItemDto(item.Id, item.ClinicId, item.Code, item.Name, item.Description, item.Category, item.DefaultPrice, item.EstimatedDurationMinutes, item.IsActive);
    }
}

public sealed class CreateCatalogItemCommandValidator : AbstractValidator<CreateCatalogItemCommand>
{
    public CreateCatalogItemCommandValidator()
    {
        RuleFor(x => x.Code)
            .NotEmpty().WithMessage("Code is required.")
            .Length(2, 50).WithMessage("Code must be between 2 and 50 characters.");

        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Name is required.")
            .MaximumLength(200).WithMessage("Name cannot exceed 200 characters.");

        RuleFor(x => x.DefaultPrice)
            .InclusiveBetween(0, 999_999).WithMessage("Default price must be between 0 and 999 999 UAH.");

        RuleFor(x => x.EstimatedDurationMinutes)
            .InclusiveBetween(0, 600).WithMessage("Estimated duration must be between 0 and 600 minutes.");

        RuleFor(x => x.Description).MaximumLength(1000).WithMessage("Description cannot exceed 1000 characters.");
        RuleFor(x => x.Category).MaximumLength(100).WithMessage("Category cannot exceed 100 characters.");
    }
}

public sealed class UpdateCatalogItemCommandValidator : AbstractValidator<UpdateCatalogItemCommand>
{
    public UpdateCatalogItemCommandValidator()
    {
        RuleFor(x => x.ItemId).NotEmpty().WithMessage("Item identifier is required.");
        RuleFor(x => x.Name).NotEmpty().WithMessage("Name is required.").MaximumLength(200);
        RuleFor(x => x.DefaultPrice).InclusiveBetween(0, 999_999).WithMessage("Default price must be between 0 and 999 999 UAH.");
        RuleFor(x => x.EstimatedDurationMinutes).InclusiveBetween(0, 600);
    }
}
