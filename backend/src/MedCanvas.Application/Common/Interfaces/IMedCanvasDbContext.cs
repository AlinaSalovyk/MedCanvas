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
    DbSet<Appointment> Appointments { get; }
    DbSet<ClinicChair> ClinicChairs { get; }
    DbSet<ProviderAvailability> ProviderAvailabilities { get; }
    DbSet<ProviderAvailabilityBreak> ProviderAvailabilityBreaks { get; }
    DbSet<ProviderAvailabilityException> ProviderAvailabilityExceptions { get; }
    DbSet<ProcedureCatalogItem> ProcedureCatalogItems { get; }
    DbSet<TreatmentPlan> TreatmentPlans { get; }
    DbSet<TreatmentPlanItem> TreatmentPlanItems { get; }
    DbSet<PerformedProcedure> PerformedProcedures { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
