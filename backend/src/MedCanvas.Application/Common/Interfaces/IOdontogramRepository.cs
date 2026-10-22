using MedCanvas.Domain.Entities;

namespace MedCanvas.Application.Common.Interfaces;

/// <summary>
/// Repository abstraction for accessing and persisting OdontogramRecord aggregates with clinic tenant scoping.
/// </summary>
public interface IOdontogramRepository
{
    Task<OdontogramRecord?> GetByIdAsync(Guid id, Guid clinicId, CancellationToken cancellationToken = default);
    Task<OdontogramRecord?> GetByEncounterIdAsync(Guid encounterId, Guid clinicId, CancellationToken cancellationToken = default);
    Task<OdontogramRecord?> GetLatestByPatientIdAsync(Guid patientId, Guid clinicId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<OdontogramRevision>> GetRevisionsAsync(Guid odontogramRecordId, Guid clinicId, CancellationToken cancellationToken = default);
    Task<OdontogramRevision?> GetRevisionByNumberAsync(Guid odontogramRecordId, int revisionNumber, Guid clinicId, CancellationToken cancellationToken = default);
    void Add(OdontogramRecord record);
    void AddRevision(OdontogramRevision revision);
}
