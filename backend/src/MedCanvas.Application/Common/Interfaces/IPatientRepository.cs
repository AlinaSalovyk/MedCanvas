using MedCanvas.Domain.Entities;

namespace MedCanvas.Application.Common.Interfaces;

/// <summary>
/// Repository abstraction for Patient aggregate persistence and lookups.
/// </summary>
public interface IPatientRepository
{
    Task<Patient?> GetByIdAsync(Guid id, Guid clinicId, CancellationToken cancellationToken = default);
    Task<bool> ExistsByMrnAsync(string mrn, Guid clinicId, Guid? excludePatientId = null, CancellationToken cancellationToken = default);
    void Add(Patient patient);
}
