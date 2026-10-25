using MedCanvas.Application.Common.Exceptions;
using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Domain.Entities;
using MediatR;

namespace MedCanvas.Application.Features.Encounters;

public sealed class CancelEncounterCommandHandler : IRequestHandler<CancelEncounterCommand, EncounterDto>
{
    private readonly IEncounterRepository _encounterRepository;
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IMedCanvasDbContext _dbContext;
    private readonly IDateTimeProvider _dateTimeProvider;

    public CancelEncounterCommandHandler(
        IEncounterRepository encounterRepository,
        ICurrentUserContext currentUserContext,
        IMedCanvasDbContext dbContext,
        IDateTimeProvider dateTimeProvider)
    {
        _encounterRepository = encounterRepository;
        _currentUserContext = currentUserContext;
        _dbContext = dbContext;
        _dateTimeProvider = dateTimeProvider;
    }

    public async Task<EncounterDto> Handle(CancelEncounterCommand request, CancellationToken cancellationToken)
    {
        if (!_currentUserContext.IsAuthenticated || _currentUserContext.ClinicId == null)
        {
            throw new UnauthorizedAccessException("Authenticated clinic context is required to cancel an encounter.");
        }

        var clinicId = _currentUserContext.ClinicId.Value;

        var encounter = await _encounterRepository.GetByIdAsync(request.Id, clinicId, cancellationToken);
        if (encounter == null)
        {
            throw new NotFoundException(nameof(DentalEncounter), request.Id);
        }

        var now = _dateTimeProvider.UtcNow;
        encounter.Cancel(request.Reason, now);

        await _dbContext.SaveChangesAsync(cancellationToken);

        return new EncounterDto(
            encounter.Id,
            encounter.ClinicId,
            encounter.PatientId,
            encounter.AttendingUserId,
            encounter.EncounterDateUtc,
            encounter.ChiefComplaint,
            encounter.ClinicalNotes,
            encounter.Status.ToString(),
            encounter.AppointmentId,
            encounter.CreatedAtUtc,
            encounter.UpdatedAtUtc);
    }
}
