using MedCanvas.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace MedCanvas.Application.Common.Interfaces;

/// <summary>
/// Abstraction for the MedCanvas Entity Framework Core database context.
/// </summary>
public interface IMedCanvasDbContext
{
    DbSet<Clinic> Clinics { get; }
    DbSet<User> Users { get; }
    DbSet<ClinicMembership> ClinicMemberships { get; }
    DbSet<Patient> Patients { get; }
    DbSet<DentalEncounter> DentalEncounters { get; }
    DbSet<OdontogramRecord> OdontogramRecords { get; }
    DbSet<OdontogramRevision> OdontogramRevisions { get; }
    DbSet<ClinicalAuditEvent> ClinicalAuditEvents { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
