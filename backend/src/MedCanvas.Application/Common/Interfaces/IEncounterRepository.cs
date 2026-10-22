using MedCanvas.Domain.Entities;

namespace MedCanvas.Application.Common.Interfaces;

/// <summary>
/// Repository abstraction for DentalEncounter aggregate persistence.
/// </summary>
public interface IEncounterRepository
{
    Task<DentalEncounter?> GetByIdAsync(Guid id, Guid clinicId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<DentalEncounter>> GetByPatientIdAsync(Guid patientId, Guid clinicId, CancellationToken cancellationToken = default);
    void Add(DentalEncounter encounter);
}
