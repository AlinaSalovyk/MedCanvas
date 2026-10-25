using FluentValidation;
using MedCanvas.Application.Common.Exceptions;
using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace MedCanvas.Application.Features.Scheduling;

public sealed class GetAvailabilityQueryHandler : IRequestHandler<GetAvailabilityQuery, AvailabilityTemplateDto>
{
    private readonly IMedCanvasDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;

    public GetAvailabilityQueryHandler(IMedCanvasDbContext dbContext, ICurrentUserContext currentUserContext)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
    }

    public async Task<AvailabilityTemplateDto> Handle(GetAvailabilityQuery request, CancellationToken cancellationToken)
    {
        if (!_currentUserContext.IsAuthenticated || _currentUserContext.ClinicId == null)
        {
            throw new UnauthorizedAccessException("Authenticated clinic context is required.");
        }

        var clinicId = _currentUserContext.ClinicId.Value;

        var clinician = await _dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == request.ClinicianUserId, cancellationToken);
        if (clinician == null)
        {
            throw new NotFoundException(nameof(User), request.ClinicianUserId);
        }

        var membershipExists = await _dbContext.ClinicMemberships
            .AsNoTracking()
            .AnyAsync(m => m.ClinicId == clinicId && m.UserId == request.ClinicianUserId && m.IsActive, cancellationToken);
        if (!membershipExists)
        {
            throw new NotFoundException(nameof(ClinicMembership), request.ClinicianUserId);
        }

        var windows = await _dbContext.ProviderAvailabilities
            .AsNoTracking()
            .Where(a => a.ClinicId == clinicId && a.ClinicianUserId == request.ClinicianUserId)
            .OrderBy(a => a.DayOfWeek)
            .ThenBy(a => a.StartTime)
            .ToListAsync(cancellationToken);

        var windowIds = windows.Select(w => w.Id).ToList();
        var breaks = await _dbContext.ProviderAvailabilityBreaks
            .AsNoTracking()
            .Where(b => windowIds.Contains(b.ProviderAvailabilityId))
            .ToListAsync(cancellationToken);

        var exceptions = await _dbContext.ProviderAvailabilityExceptions
            .AsNoTracking()
            .Where(e => e.ClinicId == clinicId && e.ClinicianUserId == request.ClinicianUserId)
            .OrderBy(e => e.Date)
            .ToListAsync(cancellationToken);

        return new AvailabilityTemplateDto(
            request.ClinicianUserId,
            clinician.FullName,
            windows
                .Select(w => new AvailabilityWindowDto(
                    w.DayOfWeek,
                    w.StartTime,
                    w.EndTime,
                    breaks.Where(b => b.ProviderAvailabilityId == w.Id)
                        .Select(b => new AvailabilityBreakDto(b.StartTime, b.EndTime))
                        .ToList()))
                .ToList(),
            exceptions.Select(e => new AvailabilityExceptionDto(e.Id, e.Date, e.IsWorkingDay)).ToList());
    }
}

public sealed class ReplaceAvailabilityCommandHandler : IRequestHandler<ReplaceAvailabilityCommand, AvailabilityTemplateDto>
{
    private readonly IMedCanvasDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IDateTimeProvider _dateTimeProvider;

    public ReplaceAvailabilityCommandHandler(IMedCanvasDbContext dbContext, ICurrentUserContext currentUserContext, IDateTimeProvider dateTimeProvider)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
        _dateTimeProvider = dateTimeProvider;
    }

    public async Task<AvailabilityTemplateDto> Handle(ReplaceAvailabilityCommand request, CancellationToken cancellationToken)
    {
        if (!_currentUserContext.IsAuthenticated || _currentUserContext.ClinicId == null || _currentUserContext.UserId == null)
        {
            throw new UnauthorizedAccessException("Authenticated clinic context is required.");
        }

        var clinicId = _currentUserContext.ClinicId.Value;

        var isSelf = request.ClinicianUserId == _currentUserContext.UserId.Value;
        var isAdmin = _currentUserContext.Role == Domain.Enums.MembershipRole.ClinicAdmin;
        if (!isSelf && !isAdmin)
        {
            throw new ForbiddenAccessException("Only the clinician or a clinic administrator can edit this availability.");
        }

        var membershipExists = await _dbContext.ClinicMemberships
            .AsNoTracking()
            .AnyAsync(m => m.ClinicId == clinicId && m.UserId == request.ClinicianUserId && m.IsActive, cancellationToken);
        if (!membershipExists)
        {
            throw new NotFoundException(nameof(ClinicMembership), request.ClinicianUserId);
        }

        var now = _dateTimeProvider.UtcNow;

        // Full replace: breaks cascade-delete with their windows.
        var existing = _dbContext.ProviderAvailabilities
            .Where(a => a.ClinicId == clinicId && a.ClinicianUserId == request.ClinicianUserId);
        _dbContext.ProviderAvailabilities.RemoveRange(existing);

        foreach (var window in request.Windows)
        {
            var availability = ProviderAvailability.Create(clinicId, request.ClinicianUserId, window.DayOfWeek, window.StartTime, window.EndTime, now);
            _dbContext.ProviderAvailabilities.Add(availability);
            foreach (var breakInput in window.Breaks)
            {
                _dbContext.ProviderAvailabilityBreaks.Add(ProviderAvailabilityBreak.Create(availability.Id, breakInput.StartTime, breakInput.EndTime, now));
            }
        }

        _dbContext.ClinicalAuditEvents.Add(ClinicalAuditEvent.Create(
            clinicId, null, null, _currentUserContext.UserId.Value,
            "AVAILABILITY_UPDATED", null, $"clinician:{request.ClinicianUserId};windows:{request.Windows.Count}", now));

        await _dbContext.SaveChangesAsync(cancellationToken);

        return await new GetAvailabilityQueryHandler(_dbContext, _currentUserContext)
            .Handle(new GetAvailabilityQuery(request.ClinicianUserId), cancellationToken);
    }
}

public sealed class AddAvailabilityExceptionCommandHandler : IRequestHandler<AddAvailabilityExceptionCommand, AvailabilityTemplateDto>
{
    private readonly IMedCanvasDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IDateTimeProvider _dateTimeProvider;

    public AddAvailabilityExceptionCommandHandler(IMedCanvasDbContext dbContext, ICurrentUserContext currentUserContext, IDateTimeProvider dateTimeProvider)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
        _dateTimeProvider = dateTimeProvider;
    }

    public async Task<AvailabilityTemplateDto> Handle(AddAvailabilityExceptionCommand request, CancellationToken cancellationToken)
    {
        if (!_currentUserContext.IsAuthenticated || _currentUserContext.ClinicId == null || _currentUserContext.UserId == null)
        {
            throw new UnauthorizedAccessException("Authenticated clinic context is required.");
        }

        var clinicId = _currentUserContext.ClinicId.Value;

        var duplicate = await _dbContext.ProviderAvailabilityExceptions
            .FirstOrDefaultAsync(e => e.ClinicId == clinicId && e.ClinicianUserId == request.ClinicianUserId && e.Date == request.Date, cancellationToken);
        if (duplicate != null)
        {
            throw new ConflictException("An exception for this date already exists.");
        }

        _dbContext.ProviderAvailabilityExceptions.Add(ProviderAvailabilityException.Create(
            clinicId, request.ClinicianUserId, request.Date, request.IsWorkingDay, _dateTimeProvider.UtcNow));

        await _dbContext.SaveChangesAsync(cancellationToken);

        return await new GetAvailabilityQueryHandler(_dbContext, _currentUserContext)
            .Handle(new GetAvailabilityQuery(request.ClinicianUserId), cancellationToken);
    }
}

public sealed class RemoveAvailabilityExceptionCommandHandler : IRequestHandler<RemoveAvailabilityExceptionCommand>
{
    private readonly IMedCanvasDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;

    public RemoveAvailabilityExceptionCommandHandler(IMedCanvasDbContext dbContext, ICurrentUserContext currentUserContext)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
    }

    public async Task Handle(RemoveAvailabilityExceptionCommand request, CancellationToken cancellationToken)
    {
        if (!_currentUserContext.IsAuthenticated || _currentUserContext.ClinicId == null)
        {
            throw new UnauthorizedAccessException("Authenticated clinic context is required.");
        }

        var exception = await _dbContext.ProviderAvailabilityExceptions
            .FirstOrDefaultAsync(e => e.Id == request.ExceptionId && e.ClinicId == _currentUserContext.ClinicId.Value, cancellationToken);
        if (exception == null)
        {
            throw new NotFoundException(nameof(ProviderAvailabilityException), request.ExceptionId);
        }

        _dbContext.ProviderAvailabilityExceptions.Remove(exception);
        await _dbContext.SaveChangesAsync(cancellationToken);
    }
}

public sealed class ReplaceAvailabilityCommandValidator : AbstractValidator<ReplaceAvailabilityCommand>
{
    public ReplaceAvailabilityCommandValidator()
    {
        RuleFor(x => x.ClinicianUserId).NotEmpty().WithMessage("Clinician identifier is required.");

        RuleFor(x => x.Windows)
            .Must(w => w.Count <= 70).WithMessage("At most 10 windows per weekday are supported.");

        RuleForEach(x => x.Windows).ChildRules(window =>
        {
            window.RuleFor(w => w.DayOfWeek)
                .InclusiveBetween(1, 7).WithMessage("Day of week must be 1 (Monday) through 7 (Sunday).");
            window.RuleFor(w => w.EndTime).GreaterThan(w => w.StartTime).WithMessage("Window end must be after its start.");
            window.RuleForEach(w => w.Breaks).ChildRules(br =>
            {
                br.RuleFor(b => b.EndTime).GreaterThan(b => b.StartTime).WithMessage("Break end must be after its start.");
            });
        });
    }
}

public sealed class AddAvailabilityExceptionCommandValidator : AbstractValidator<AddAvailabilityExceptionCommand>
{
    public AddAvailabilityExceptionCommandValidator()
    {
        RuleFor(x => x.ClinicianUserId).NotEmpty().WithMessage("Clinician identifier is required.");
    }
}

public sealed class RemoveAvailabilityExceptionCommandValidator : AbstractValidator<RemoveAvailabilityExceptionCommand>
{
    public RemoveAvailabilityExceptionCommandValidator()
    {
        RuleFor(x => x.ExceptionId).NotEmpty().WithMessage("Exception identifier is required.");
    }
}
