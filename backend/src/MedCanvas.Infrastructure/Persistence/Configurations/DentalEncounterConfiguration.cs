using MedCanvas.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MedCanvas.Infrastructure.Persistence.Configurations;

public sealed class DentalEncounterConfiguration : IEntityTypeConfiguration<DentalEncounter>
{
    public void Configure(EntityTypeBuilder<DentalEncounter> builder)
    {
        builder.ToTable("DentalEncounters");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.ClinicId)
            .IsRequired();

        builder.Property(e => e.PatientId)
            .IsRequired();

        builder.Property(e => e.AttendingUserId)
            .IsRequired();

        builder.Property(e => e.EncounterDateUtc)
            .IsRequired();

        builder.Property(e => e.ChiefComplaint)
            .HasMaxLength(1000);

        builder.Property(e => e.ClinicalNotes)
            .HasMaxLength(4000);

        builder.Property(e => e.Status)
            .IsRequired()
            .HasConversion<string>()
            .HasMaxLength(30);

        builder.Property(e => e.CreatedAtUtc)
            .IsRequired();

        builder.Property(e => e.UpdatedAtUtc)
            .IsRequired();

        builder.HasOne<Clinic>()
            .WithMany()
            .HasForeignKey(e => e.ClinicId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<Patient>()
            .WithMany()
            .HasForeignKey(e => e.PatientId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(e => e.AttendingUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(e => new { e.PatientId, e.EncounterDateUtc });
        builder.HasIndex(e => new { e.ClinicId, e.EncounterDateUtc });
    }
}
