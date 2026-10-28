using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Domain.Common;
using MedCanvas.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace MedCanvas.Infrastructure.Persistence;

public class MedCanvasDbContext : DbContext, IMedCanvasDbContext
{
    private readonly IDateTimeProvider? _dateTimeProvider;

    public DbSet<Clinic> Clinics => Set<Clinic>();
    public DbSet<User> Users => Set<User>();
    public DbSet<ClinicMembership> ClinicMemberships => Set<ClinicMembership>();
    public DbSet<Patient> Patients => Set<Patient>();
    public DbSet<DentalEncounter> DentalEncounters => Set<DentalEncounter>();
    public DbSet<OdontogramRecord> OdontogramRecords => Set<OdontogramRecord>();
    public DbSet<OdontogramRevision> OdontogramRevisions => Set<OdontogramRevision>();
    public DbSet<ClinicalAuditEvent> ClinicalAuditEvents => Set<ClinicalAuditEvent>();
    public DbSet<Appointment> Appointments => Set<Appointment>();
    public DbSet<ClinicChair> ClinicChairs => Set<ClinicChair>();
    public DbSet<ProviderAvailability> ProviderAvailabilities => Set<ProviderAvailability>();
    public DbSet<ProviderAvailabilityBreak> ProviderAvailabilityBreaks => Set<ProviderAvailabilityBreak>();
    public DbSet<ProviderAvailabilityException> ProviderAvailabilityExceptions => Set<ProviderAvailabilityException>();
    public DbSet<ProcedureCatalogItem> ProcedureCatalogItems => Set<ProcedureCatalogItem>();
    public DbSet<TreatmentPlan> TreatmentPlans => Set<TreatmentPlan>();
    public DbSet<TreatmentPlanItem> TreatmentPlanItems => Set<TreatmentPlanItem>();
    public DbSet<PerformedProcedure> PerformedProcedures => Set<PerformedProcedure>();
    public DbSet<Invoice> Invoices => Set<Invoice>();
    public DbSet<SimulatedPayment> SimulatedPayments => Set<SimulatedPayment>();

    public MedCanvasDbContext(DbContextOptions<MedCanvasDbContext> options)
        : base(options)
    {
    }

    public MedCanvasDbContext(
        DbContextOptions<MedCanvasDbContext> options,
        IDateTimeProvider dateTimeProvider)
        : base(options)
    {
        _dateTimeProvider = dateTimeProvider;
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(MedCanvasDbContext).Assembly);
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var now = _dateTimeProvider?.UtcNow ?? DateTime.UtcNow;

        foreach (var entry in ChangeTracker.Entries<BaseEntity>())
        {
            if (entry.State == EntityState.Added)
            {
                if (entry.Entity.CreatedAtUtc == default)
                {
                    entry.Property(e => e.CreatedAtUtc).CurrentValue = now;
                }
                if (entry.Entity.UpdatedAtUtc == default)
                {
                    entry.Property(e => e.UpdatedAtUtc).CurrentValue = now;
                }
            }
            else if (entry.State == EntityState.Modified)
            {
                entry.Property(e => e.UpdatedAtUtc).CurrentValue = now;
            }
        }

        try
        {
            return await base.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (exception.InnerException is Npgsql.PostgresException
        { SqlState: "23505", ConstraintName: "IX_Invoices_ClinicId_EncounterId" or "IX_Invoices_InvoiceNumber" or "IX_SimulatedPayments_ClinicId_IdempotencyKey" or "IX_PerformedProcedures_ClinicId_IdempotencyKey" or "IX_PerformedProcedures_TreatmentPlanItemId" })
        {
            throw new MedCanvas.Application.Common.Exceptions.ConflictException("A financial or procedure operation already exists. Refresh and retry using the original operation key.");
        }
    }
}
