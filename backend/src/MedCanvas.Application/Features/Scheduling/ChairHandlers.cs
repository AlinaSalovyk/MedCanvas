using FluentValidation;
using MedCanvas.Application.Common.Exceptions;
using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace MedCanvas.Application.Features.Scheduling;

public sealed class GetChairsQueryHandler : IRequestHandler<GetChairsQuery, IReadOnlyList<ChairDto>>
{
    private readonly IMedCanvasDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;

    public GetChairsQueryHandler(IMedCanvasDbContext dbContext, ICurrentUserContext currentUserContext)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
    }

    public async Task<IReadOnlyList<ChairDto>> Handle(GetChairsQuery request, CancellationToken cancellationToken)
    {
        if (!_currentUserContext.IsAuthenticated || _currentUserContext.ClinicId == null)
        {
            throw new UnauthorizedAccessException("Authenticated clinic context is required.");
        }

        return await _dbContext.ClinicChairs
            .AsNoTracking()
            .Where(c => c.ClinicId == _currentUserContext.ClinicId.Value)
            .OrderBy(c => c.Name)
            .Select(c => new ChairDto(c.Id, c.ClinicId, c.Name, c.IsActive))
            .ToListAsync(cancellationToken);
    }
}

public sealed class CreateChairCommandHandler : IRequestHandler<CreateChairCommand, ChairDto>
{
    private readonly IMedCanvasDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IDateTimeProvider _dateTimeProvider;

    public CreateChairCommandHandler(IMedCanvasDbContext dbContext, ICurrentUserContext currentUserContext, IDateTimeProvider dateTimeProvider)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
        _dateTimeProvider = dateTimeProvider;
    }

    public async Task<ChairDto> Handle(CreateChairCommand request, CancellationToken cancellationToken)
    {
        if (!_currentUserContext.IsAuthenticated || _currentUserContext.ClinicId == null || _currentUserContext.UserId == null)
        {
            throw new UnauthorizedAccessException("Authenticated clinic context is required.");
        }

        var clinicId = _currentUserContext.ClinicId.Value;
        var name = request.Name.Trim();

        var nameTaken = await _dbContext.ClinicChairs
            .AsNoTracking()
            .AnyAsync(c => c.ClinicId == clinicId && c.Name == name, cancellationToken);
        if (nameTaken)
        {
            throw new ConflictException("A chair with this name already exists in the clinic.");
        }

        var chair = ClinicChair.Create(clinicId, name, _dateTimeProvider.UtcNow);
        _dbContext.ClinicChairs.Add(chair);

        _dbContext.ClinicalAuditEvents.Add(ClinicalAuditEvent.Create(
            clinicId, null, null, _currentUserContext.UserId.Value, "CHAIR_CREATED", null, $"chair:{chair.Id}", _dateTimeProvider.UtcNow));

        await _dbContext.SaveChangesAsync(cancellationToken);
        return new ChairDto(chair.Id, chair.ClinicId, chair.Name, chair.IsActive);
    }
}

public sealed class RenameChairCommandHandler : IRequestHandler<RenameChairCommand, ChairDto>
{
    private readonly IMedCanvasDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IDateTimeProvider _dateTimeProvider;

    public RenameChairCommandHandler(IMedCanvasDbContext dbContext, ICurrentUserContext currentUserContext, IDateTimeProvider dateTimeProvider)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
        _dateTimeProvider = dateTimeProvider;
    }

    public async Task<ChairDto> Handle(RenameChairCommand request, CancellationToken cancellationToken)
    {
        var chair = await ChairHandlers.LoadChairAsync(_dbContext, _currentUserContext, request.ChairId, cancellationToken);
        chair.Rename(request.Name, _dateTimeProvider.UtcNow);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return new ChairDto(chair.Id, chair.ClinicId, chair.Name, chair.IsActive);
    }
}

public sealed class SetChairActiveCommandHandler : IRequestHandler<SetChairActiveCommand, ChairDto>
{
    private readonly IMedCanvasDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IDateTimeProvider _dateTimeProvider;

    public SetChairActiveCommandHandler(IMedCanvasDbContext dbContext, ICurrentUserContext currentUserContext, IDateTimeProvider dateTimeProvider)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
        _dateTimeProvider = dateTimeProvider;
    }

    public async Task<ChairDto> Handle(SetChairActiveCommand request, CancellationToken cancellationToken)
    {
        var chair = await ChairHandlers.LoadChairAsync(_dbContext, _currentUserContext, request.ChairId, cancellationToken);
        if (request.Active)
        {
            chair.Activate(_dateTimeProvider.UtcNow);
        }
        else
        {
            chair.Deactivate(_dateTimeProvider.UtcNow);
        }

        _dbContext.ClinicalAuditEvents.Add(ClinicalAuditEvent.Create(
            chair.ClinicId, null, null, _currentUserContext.UserId!.Value,
            request.Active ? "CHAIR_ACTIVATED" : "CHAIR_DEACTIVATED", null, $"chair:{chair.Id}", _dateTimeProvider.UtcNow));

        await _dbContext.SaveChangesAsync(cancellationToken);
        return new ChairDto(chair.Id, chair.ClinicId, chair.Name, chair.IsActive);
    }
}

internal static class ChairHandlers
{
    public static async Task<ClinicChair> LoadChairAsync(
        IMedCanvasDbContext dbContext,
        ICurrentUserContext currentUserContext,
        Guid chairId,
        CancellationToken cancellationToken)
    {
        if (!currentUserContext.IsAuthenticated || currentUserContext.ClinicId == null || currentUserContext.UserId == null)
        {
            throw new UnauthorizedAccessException("Authenticated clinic context is required.");
        }

        var chair = await dbContext.ClinicChairs
            .FirstOrDefaultAsync(c => c.Id == chairId && c.ClinicId == currentUserContext.ClinicId.Value, cancellationToken);

        if (chair == null)
        {
            throw new NotFoundException(nameof(ClinicChair), chairId);
        }

        return chair;
    }
}

public sealed class ChairCommandValidatorBase : AbstractValidator<CreateChairCommand>
{
    public ChairCommandValidatorBase()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Chair name is required.")
            .MaximumLength(100).WithMessage("Chair name cannot exceed 100 characters.");
    }
}

public sealed class RenameChairCommandValidator : AbstractValidator<RenameChairCommand>
{
    public RenameChairCommandValidator()
    {
        RuleFor(x => x.ChairId).NotEmpty().WithMessage("Chair identifier is required.");
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Chair name is required.")
            .MaximumLength(100).WithMessage("Chair name cannot exceed 100 characters.");
    }
}
