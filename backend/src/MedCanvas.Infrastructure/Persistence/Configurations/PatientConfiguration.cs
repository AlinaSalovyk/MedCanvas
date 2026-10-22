using MedCanvas.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MedCanvas.Infrastructure.Persistence.Configurations;

public sealed class PatientConfiguration : IEntityTypeConfiguration<Patient>
{
    public void Configure(EntityTypeBuilder<Patient> builder)
    {
        builder.ToTable("Patients");

        builder.HasKey(p => p.Id);

        builder.Property(p => p.ClinicId)
            .IsRequired();

        builder.Property(p => p.FirstName)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(p => p.LastName)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(p => p.ExternalMedicalRecordNumber)
            .HasMaxLength(100);

        builder.Property(p => p.Gender)
            .HasMaxLength(20);

        builder.Property(p => p.Phone)
            .HasMaxLength(50);

        builder.Property(p => p.Email)
            .HasMaxLength(256);

        builder.Property(p => p.MedicalAlerts)
            .HasMaxLength(2000);

        builder.Property(p => p.IsActive)
            .IsRequired();

        builder.Property(p => p.CreatedAtUtc)
            .IsRequired();

        builder.Property(p => p.UpdatedAtUtc)
            .IsRequired();

        builder.HasOne<Clinic>()
            .WithMany()
            .HasForeignKey(p => p.ClinicId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(p => new { p.ClinicId, p.LastName, p.FirstName });

        builder.HasIndex(p => new { p.ClinicId, p.ExternalMedicalRecordNumber })
            .IsUnique()
            .HasFilter("\"ExternalMedicalRecordNumber\" IS NOT NULL");
    }
}
