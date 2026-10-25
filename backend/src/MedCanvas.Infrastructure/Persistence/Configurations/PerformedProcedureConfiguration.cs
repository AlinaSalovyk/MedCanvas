using MedCanvas.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MedCanvas.Infrastructure.Persistence.Configurations;

public sealed class PerformedProcedureConfiguration : IEntityTypeConfiguration<PerformedProcedure>
{
    public void Configure(EntityTypeBuilder<PerformedProcedure> builder)
    {
        builder.ToTable("PerformedProcedures");

        builder.HasKey(p => p.Id);

        builder.Property(p => p.ClinicId).IsRequired();
        builder.Property(p => p.PatientId).IsRequired();
        builder.Property(p => p.EncounterId).IsRequired();
        builder.Property(p => p.TreatmentPlanItemId);
        builder.Property(p => p.ProcedureCatalogItemId).IsRequired();
        builder.Property(p => p.ToothFdi).HasMaxLength(2);
        builder.Property(p => p.Quantity).IsRequired();
        builder.Property(p => p.PerformedByUserId).IsRequired();
        builder.Property(p => p.UnitPriceSnapshot).IsRequired().HasPrecision(12, 2);
        builder.Property(p => p.TotalAmount).IsRequired().HasPrecision(12, 2);
        builder.Property(p => p.ClinicalNote).HasMaxLength(1000);
        builder.Property(p => p.IdempotencyKey).IsRequired().HasMaxLength(100);
        builder.Property(p => p.Status).IsRequired().HasConversion<string>().HasMaxLength(20);
        builder.Property(p => p.VoidReason).HasMaxLength(500);
        builder.Property(p => p.VoidedByUserId);
        builder.Property(p => p.VoidedAtUtc);
        builder.Property(p => p.CreatedAtUtc).IsRequired();
        builder.Property(p => p.UpdatedAtUtc).IsRequired();

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
            .HasForeignKey(p => p.EncounterId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<ProcedureCatalogItem>()
            .WithMany()
            .HasForeignKey(p => p.ProcedureCatalogItemId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(p => new { p.ClinicId, p.IdempotencyKey }).IsUnique();
        builder.HasIndex(p => new { p.ClinicId, p.EncounterId });
        builder.HasIndex(p => new { p.PatientId, p.CreatedAtUtc });
    }
}
