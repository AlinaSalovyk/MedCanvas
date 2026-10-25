using MedCanvas.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MedCanvas.Infrastructure.Persistence.Configurations;

public sealed class ProcedureCatalogItemConfiguration : IEntityTypeConfiguration<ProcedureCatalogItem>
{
    public void Configure(EntityTypeBuilder<ProcedureCatalogItem> builder)
    {
        builder.ToTable("ProcedureCatalogItems");

        builder.HasKey(i => i.Id);

        builder.Property(i => i.ClinicId).IsRequired();
        builder.Property(i => i.Code).IsRequired().HasMaxLength(50);
        builder.Property(i => i.Name).IsRequired().HasMaxLength(200);
        builder.Property(i => i.Description).HasMaxLength(1000);
        builder.Property(i => i.Category).HasMaxLength(100);
        builder.Property(i => i.DefaultPrice).IsRequired().HasPrecision(12, 2);
        builder.Property(i => i.EstimatedDurationMinutes).IsRequired();
        builder.Property(i => i.IsActive).IsRequired();
        builder.Property(i => i.CreatedAtUtc).IsRequired();
        builder.Property(i => i.UpdatedAtUtc).IsRequired();

        builder.HasOne<Clinic>()
            .WithMany()
            .HasForeignKey(i => i.ClinicId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(i => new { i.ClinicId, i.Code }).IsUnique();
    }
}

public sealed class TreatmentPlanConfiguration : IEntityTypeConfiguration<TreatmentPlan>
{
    public void Configure(EntityTypeBuilder<TreatmentPlan> builder)
    {
        builder.ToTable("TreatmentPlans");

        builder.HasKey(p => p.Id);

        builder.Property(p => p.ClinicId).IsRequired();
        builder.Property(p => p.PatientId).IsRequired();
        builder.Property(p => p.SourceEncounterId).IsRequired();
        builder.Property(p => p.CreatedByUserId).IsRequired();
        builder.Property(p => p.Status).IsRequired().HasConversion<string>().HasMaxLength(30);
        builder.Property(p => p.Version).IsRequired();
        builder.Property(p => p.ApprovedAtUtc);
        builder.Property(p => p.ApprovedByUserId);
        builder.Property(p => p.CreatedAtUtc).IsRequired();
        builder.Property(p => p.UpdatedAtUtc).IsRequired();

        builder.HasMany(p => p.Items)
            .WithOne()
            .HasForeignKey(i => i.TreatmentPlanId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<Clinic>()
            .WithMany()
            .HasForeignKey(p => p.ClinicId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<Patient>()
            .WithMany()
            .HasForeignKey(p => p.PatientId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<DentalEncounter>()
            .WithMany()
            .HasForeignKey(p => p.SourceEncounterId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(p => new { p.ClinicId, p.PatientId });
    }
}

public sealed class TreatmentPlanItemConfiguration : IEntityTypeConfiguration<TreatmentPlanItem>
{
    public void Configure(EntityTypeBuilder<TreatmentPlanItem> builder)
    {
        builder.ToTable("TreatmentPlanItems");

        builder.HasKey(i => i.Id);

        builder.Property(i => i.TreatmentPlanId).IsRequired();
        builder.Property(i => i.ProcedureCatalogItemId).IsRequired();
        builder.Property(i => i.ToothFdi).HasMaxLength(2);
        builder.Property(i => i.Surface).HasMaxLength(20);
        builder.Property(i => i.Phase).HasMaxLength(100);
        builder.Property(i => i.Quantity).IsRequired();
        builder.Property(i => i.UnitPriceSnapshot).IsRequired().HasPrecision(12, 2);
        builder.Property(i => i.TotalAmount).IsRequired().HasPrecision(12, 2);
        builder.Property(i => i.Notes).HasMaxLength(500);
        builder.Property(i => i.ItemStatus).IsRequired().HasConversion<string>().HasMaxLength(20);
        builder.Property(i => i.CreatedAtUtc).IsRequired();
        builder.Property(i => i.UpdatedAtUtc).IsRequired();

        // INV-001: an item references its own clinic's catalog; Restrict keeps the
        // historical snapshot rows intact even if catalog items are ever hard-removed.
        builder.HasOne<ProcedureCatalogItem>()
            .WithMany()
            .HasForeignKey(i => i.ProcedureCatalogItemId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(i => i.TreatmentPlanId);
    }
}
