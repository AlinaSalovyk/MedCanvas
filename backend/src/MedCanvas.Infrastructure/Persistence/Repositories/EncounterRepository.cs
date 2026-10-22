using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace MedCanvas.Infrastructure.Persistence.Repositories;

public sealed class EncounterRepository : IEncounterRepository
{
    private readonly MedCanvasDbContext _context;

    public EncounterRepository(MedCanvasDbContext context)
    {
        _context = context;
    }

    public async Task<DentalEncounter?> GetByIdAsync(Guid id, Guid clinicId, CancellationToken cancellationToken = default)
    {
        return await _context.DentalEncounters
            .FirstOrDefaultAsync(e => e.Id == id && e.ClinicId == clinicId, cancellationToken);
    }

    public async Task<IReadOnlyList<DentalEncounter>> GetByPatientIdAsync(Guid patientId, Guid clinicId, CancellationToken cancellationToken = default)
    {
        return await _context.DentalEncounters
            .Where(e => e.PatientId == patientId && e.ClinicId == clinicId)
            .OrderByDescending(e => e.EncounterDateUtc)
            .ToListAsync(cancellationToken);
    }

    public void Add(DentalEncounter encounter)
    {
        _context.DentalEncounters.Add(encounter);
    }
}
