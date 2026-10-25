using FluentValidation;
using MedCanvas.Application.Common.Exceptions;
using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace MedCanvas.Application.Features.TreatmentExecution;

public sealed class VoidPerformedProcedureCommandHandler : IRequestHandler<VoidPerformedProcedureCommand, PerformedProcedureDto>
{
    private readonly IMedCanvasDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IDateTimeProvider _dateTimeProvider;

    public VoidPerformedProcedureCommandHandler(
        IMedCanvasDbContext dbContext,
        ICurrentUserContext currentUserContext,
        IDateTimeProvider dateTimeProvider)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
        _dateTimeProvider = dateTimeProvider;
    }

    public async Task<PerformedProcedureDto> Handle(VoidPerformedProcedureCommand request, CancellationToken cancellationToken)
    {
        if (!_currentUserContext.IsAuthenticated || _currentUserContext.ClinicId == null || _currentUserContext.UserId == null)
        {
            throw new UnauthorizedAccessException("Authenticated clinic context is required.");
        }

        var clinicId = _currentUserContext.ClinicId.Value;

        var performed = await _dbContext.PerformedProcedures
            .FirstOrDefaultAsync(p => p.Id == request.PerformedProcedureId && p.ClinicId == clinicId, cancellationToken);
        if (performed == null)
        {
            throw new NotFoundException(nameof(PerformedProcedure), request.PerformedProcedureId);
        }

        performed.Void(_currentUserContext.UserId.Value, request.Reason, _dateTimeProvider.UtcNow);

        _dbContext.ClinicalAuditEvents.Add(ClinicalAuditEvent.Create(
            clinicId,
            performed.PatientId,
            performed.EncounterId,
            _currentUserContext.UserId.Value,
            "PROCEDURE_VOIDED",
            null,
            $"procedure:{performed.Id};reason:{request.Reason.Trim()}",
            _dateTimeProvider.UtcNow));

        await _dbContext.SaveChangesAsync(cancellationToken);

        return await RecordPerformedProcedureCommandHandler.ProjectAsync(_dbContext, performed, cancellationToken);
    }
}

public sealed class VoidPerformedProcedureCommandValidator : AbstractValidator<VoidPerformedProcedureCommand>
{
    public VoidPerformedProcedureCommandValidator()
    {
        RuleFor(x => x.PerformedProcedureId).NotEmpty().WithMessage("Performed procedure identifier is required.");
        RuleFor(x => x.Reason)
            .NotEmpty().WithMessage("Void reason is required.")
            .MaximumLength(500).WithMessage("Void reason cannot exceed 500 characters.");
    }
}

public sealed class GetEncounterPerformedProceduresQueryHandler : IRequestHandler<GetEncounterPerformedProceduresQuery, IReadOnlyList<PerformedProcedureDto>>
{
    private readonly IMedCanvasDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;

    public GetEncounterPerformedProceduresQueryHandler(IMedCanvasDbContext dbContext, ICurrentUserContext currentUserContext)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
    }

    public async Task<IReadOnlyList<PerformedProcedureDto>> Handle(GetEncounterPerformedProceduresQuery request, CancellationToken cancellationToken)
    {
        if (!_currentUserContext.IsAuthenticated || _currentUserContext.ClinicId == null)
        {
            throw new UnauthorizedAccessException("Authenticated clinic context is required.");
        }

        var performed = await _dbContext.PerformedProcedures
            .AsNoTracking()
            .Where(p => p.ClinicId == _currentUserContext.ClinicId.Value && p.EncounterId == request.EncounterId)
            .OrderBy(p => p.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        var result = new List<PerformedProcedureDto>(performed.Count);
        foreach (var item in performed)
        {
            result.Add(await RecordPerformedProcedureCommandHandler.ProjectAsync(_dbContext, item, cancellationToken));
        }

        return result;
    }
}

public sealed class GetPatientPerformedProceduresQueryHandler : IRequestHandler<GetPatientPerformedProceduresQuery, IReadOnlyList<PerformedProcedureDto>>
{
    private readonly IMedCanvasDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;

    public GetPatientPerformedProceduresQueryHandler(IMedCanvasDbContext dbContext, ICurrentUserContext currentUserContext)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
    }

    public async Task<IReadOnlyList<PerformedProcedureDto>> Handle(GetPatientPerformedProceduresQuery request, CancellationToken cancellationToken)
    {
        if (!_currentUserContext.IsAuthenticated || _currentUserContext.ClinicId == null)
        {
            throw new UnauthorizedAccessException("Authenticated clinic context is required.");
        }

        var performed = await _dbContext.PerformedProcedures
            .AsNoTracking()
            .Where(p => p.ClinicId == _currentUserContext.ClinicId.Value && p.PatientId == request.PatientId)
            .OrderByDescending(p => p.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        var result = new List<PerformedProcedureDto>(performed.Count);
        foreach (var item in performed)
        {
            result.Add(await RecordPerformedProcedureCommandHandler.ProjectAsync(_dbContext, item, cancellationToken));
        }

        return result;
    }
}
