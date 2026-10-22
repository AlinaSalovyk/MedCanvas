using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace MedCanvas.Infrastructure.Persistence.Repositories;

public sealed class PatientRepository : IPatientRepository
{
    private readonly MedCanvasDbContext _context;

    public PatientRepository(MedCanvasDbContext context)
    {
        _context = context;
    }

    public async Task<Patient?> GetByIdAsync(Guid id, Guid clinicId, CancellationToken cancellationToken = default)
    {
        return await _context.Patients
            .FirstOrDefaultAsync(p => p.Id == id && p.ClinicId == clinicId, cancellationToken);
    }

    public async Task<bool> ExistsByMrnAsync(string mrn, Guid clinicId, Guid? excludePatientId = null, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(mrn))
        {
            return false;
        }

        var query = _context.Patients
            .Where(p => p.ClinicId == clinicId && p.ExternalMedicalRecordNumber == mrn.Trim());

        if (excludePatientId.HasValue)
        {
            query = query.Where(p => p.Id != excludePatientId.Value);
        }

        return await query.AnyAsync(cancellationToken);
    }

    public void Add(Patient patient)
    {
        _context.Patients.Add(patient);
    }
}
