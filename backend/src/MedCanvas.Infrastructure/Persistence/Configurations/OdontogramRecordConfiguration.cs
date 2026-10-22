using MedCanvas.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MedCanvas.Infrastructure.Persistence.Configurations;

public sealed class OdontogramRecordConfiguration : IEntityTypeConfiguration<OdontogramRecord>
{
    public void Configure(EntityTypeBuilder<OdontogramRecord> builder)
    {
        builder.ToTable("OdontogramRecords");

        builder.HasKey(o => o.Id);

        builder.Property(o => o.ClinicId)
            .IsRequired();

        builder.Property(o => o.PatientId)
            .IsRequired();

        builder.Property(o => o.EncounterId)
            .IsRequired();

        builder.Property(o => o.PayloadVersion)
            .IsRequired()
            .HasMaxLength(20);

        builder.Property(o => o.SnapshotJson)
            .IsRequired()
            .HasColumnType("jsonb");

        builder.Property(o => o.ConcurrencyVersion)
            .IsRequired()
            .IsConcurrencyToken();

        builder.Property(o => o.IsFinalized)
            .IsRequired();

        builder.Property(o => o.FinalizedAtUtc);

        builder.Property(o => o.FinalizedByUserId);

        builder.Property(o => o.CreatedAtUtc)
            .IsRequired();

        builder.Property(o => o.UpdatedAtUtc)
            .IsRequired();

        builder.HasOne<Clinic>()
            .WithMany()
            .HasForeignKey(o => o.ClinicId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<Patient>()
            .WithMany()
            .HasForeignKey(o => o.PatientId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<DentalEncounter>()
            .WithMany()
            .HasForeignKey(o => o.EncounterId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(o => o.FinalizedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(o => o.EncounterId)
            .IsUnique();

        builder.HasIndex(o => new { o.PatientId, o.UpdatedAtUtc });
    }
}
