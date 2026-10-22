using MedCanvas.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MedCanvas.Infrastructure.Persistence.Configurations;

public sealed class OdontogramRevisionConfiguration : IEntityTypeConfiguration<OdontogramRevision>
{
    public void Configure(EntityTypeBuilder<OdontogramRevision> builder)
    {
        builder.ToTable("OdontogramRevisions");

        builder.HasKey(r => r.Id);

        builder.Property(r => r.OdontogramRecordId)
            .IsRequired();

        builder.Property(r => r.ClinicId)
            .IsRequired();

        builder.Property(r => r.PatientId)
            .IsRequired();

        builder.Property(r => r.EncounterId)
            .IsRequired();

        builder.Property(r => r.RevisionNumber)
            .IsRequired();

        builder.Property(r => r.SnapshotJson)
            .IsRequired()
            .HasColumnType("jsonb");

        builder.Property(r => r.CreatedByUserId)
            .IsRequired();

        builder.Property(r => r.ChangeSummary)
            .HasMaxLength(500);

        builder.Property(r => r.CreatedAtUtc)
            .IsRequired();

        builder.Property(r => r.UpdatedAtUtc)
            .IsRequired();

        builder.HasOne<OdontogramRecord>()
            .WithMany()
            .HasForeignKey(r => r.OdontogramRecordId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<Clinic>()
            .WithMany()
            .HasForeignKey(r => r.ClinicId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<Patient>()
            .WithMany()
            .HasForeignKey(r => r.PatientId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<DentalEncounter>()
            .WithMany()
            .HasForeignKey(r => r.EncounterId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(r => r.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(r => new { r.OdontogramRecordId, r.RevisionNumber })
            .IsUnique();
    }
}
