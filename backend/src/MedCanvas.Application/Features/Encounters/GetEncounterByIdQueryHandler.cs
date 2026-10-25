using MedCanvas.Application.Common.Exceptions;
using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Domain.Entities;
using MediatR;

namespace MedCanvas.Application.Features.Encounters;

public sealed class GetEncounterByIdQueryHandler : IRequestHandler<GetEncounterByIdQuery, EncounterDto>
{
    private readonly IEncounterRepository _encounterRepository;
    private readonly ICurrentUserContext _currentUserContext;

    public GetEncounterByIdQueryHandler(
        IEncounterRepository encounterRepository,
        ICurrentUserContext currentUserContext)
    {
        _encounterRepository = encounterRepository;
        _currentUserContext = currentUserContext;
    }

    public async Task<EncounterDto> Handle(GetEncounterByIdQuery request, CancellationToken cancellationToken)
    {
        if (!_currentUserContext.IsAuthenticated || _currentUserContext.ClinicId == null)
        {
            throw new UnauthorizedAccessException("Authenticated clinic context is required to query an encounter.");
        }

        var clinicId = _currentUserContext.ClinicId.Value;

        var encounter = await _encounterRepository.GetByIdAsync(request.Id, clinicId, cancellationToken);
        if (encounter == null)
        {
            throw new NotFoundException(nameof(DentalEncounter), request.Id);
        }

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
