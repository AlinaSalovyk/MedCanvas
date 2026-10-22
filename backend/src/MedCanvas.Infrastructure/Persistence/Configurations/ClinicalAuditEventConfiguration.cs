using MedCanvas.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MedCanvas.Infrastructure.Persistence.Configurations;

public sealed class ClinicalAuditEventConfiguration : IEntityTypeConfiguration<ClinicalAuditEvent>
{
    public void Configure(EntityTypeBuilder<ClinicalAuditEvent> builder)
    {
        builder.ToTable("ClinicalAuditEvents");

        builder.HasKey(a => a.Id);

        builder.Property(a => a.ClinicId)
            .IsRequired();

        builder.Property(a => a.PatientId);

        builder.Property(a => a.EncounterId);

        builder.Property(a => a.ActorUserId)
            .IsRequired();

        builder.Property(a => a.Action)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(a => a.ClientIpAddress)
            .HasMaxLength(50);

        builder.Property(a => a.DetailsHash)
            .HasMaxLength(128);

        builder.Property(a => a.TimestampUtc)
            .IsRequired();

        builder.HasOne<Clinic>()
            .WithMany()
            .HasForeignKey(a => a.ClinicId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<Patient>()
            .WithMany()
            .HasForeignKey(a => a.PatientId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<DentalEncounter>()
            .WithMany()
            .HasForeignKey(a => a.EncounterId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(a => a.ActorUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(a => new { a.ClinicId, a.PatientId, a.TimestampUtc });
    }
}
