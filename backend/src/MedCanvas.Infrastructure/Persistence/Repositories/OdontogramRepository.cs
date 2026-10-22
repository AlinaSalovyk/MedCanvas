using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace MedCanvas.Infrastructure.Persistence.Repositories;

public sealed class OdontogramRepository : IOdontogramRepository
{
    private readonly MedCanvasDbContext _context;

    public OdontogramRepository(MedCanvasDbContext context)
    {
        _context = context;
    }

    public async Task<OdontogramRecord?> GetByIdAsync(Guid id, Guid clinicId, CancellationToken cancellationToken = default)
    {
        return await _context.OdontogramRecords
            .FirstOrDefaultAsync(o => o.Id == id && o.ClinicId == clinicId, cancellationToken);
    }

    public async Task<OdontogramRecord?> GetByEncounterIdAsync(Guid encounterId, Guid clinicId, CancellationToken cancellationToken = default)
    {
        return await _context.OdontogramRecords
            .FirstOrDefaultAsync(o => o.EncounterId == encounterId && o.ClinicId == clinicId, cancellationToken);
    }

    public async Task<OdontogramRecord?> GetLatestByPatientIdAsync(Guid patientId, Guid clinicId, CancellationToken cancellationToken = default)
    {
        return await _context.OdontogramRecords
            .Where(o => o.PatientId == patientId && o.ClinicId == clinicId)
            .OrderByDescending(o => o.UpdatedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<OdontogramRevision>> GetRevisionsAsync(Guid odontogramRecordId, Guid clinicId, CancellationToken cancellationToken = default)
    {
        return await _context.OdontogramRevisions
            .Where(r => r.OdontogramRecordId == odontogramRecordId && r.ClinicId == clinicId)
            .OrderBy(r => r.RevisionNumber)
            .ToListAsync(cancellationToken);
    }

    public async Task<OdontogramRevision?> GetRevisionByNumberAsync(Guid odontogramRecordId, int revisionNumber, Guid clinicId, CancellationToken cancellationToken = default)
    {
        return await _context.OdontogramRevisions
            .FirstOrDefaultAsync(r => r.OdontogramRecordId == odontogramRecordId && r.RevisionNumber == revisionNumber && r.ClinicId == clinicId, cancellationToken);
    }

    public void Add(OdontogramRecord record)
    {
        _context.OdontogramRecords.Add(record);
    }

    public void AddRevision(OdontogramRevision revision)
    {
        _context.OdontogramRevisions.Add(revision);
    }
}
