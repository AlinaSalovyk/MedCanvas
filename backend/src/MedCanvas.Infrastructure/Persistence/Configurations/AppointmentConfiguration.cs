using MedCanvas.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MedCanvas.Infrastructure.Persistence.Configurations;

public sealed class AppointmentConfiguration : IEntityTypeConfiguration<Appointment>
{
    public void Configure(EntityTypeBuilder<Appointment> builder)
    {
        builder.ToTable("Appointments");

        builder.HasKey(a => a.Id);

        builder.Property(a => a.ClinicId).IsRequired();
        builder.Property(a => a.PatientId).IsRequired();
        builder.Property(a => a.ClinicianUserId).IsRequired();
        builder.Property(a => a.ChairId).IsRequired();
        builder.Property(a => a.StartAtUtc).IsRequired();
        builder.Property(a => a.EndAtUtc).IsRequired();
        builder.Property(a => a.Status).IsRequired().HasConversion<int>();
        builder.Property(a => a.ReasonForVisit).IsRequired().HasMaxLength(500);
        builder.Property(a => a.InternalNote).HasMaxLength(1000);
        builder.Property(a => a.CancellationReason).HasMaxLength(500);
        builder.Property(a => a.ConcurrencyVersion).IsRequired().HasDefaultValue(1).IsConcurrencyToken();
        builder.Property(a => a.CreatedAtUtc).IsRequired();
        builder.Property(a => a.UpdatedAtUtc).IsRequired();

        builder.HasOne<Patient>()
            .WithMany()
            .HasForeignKey(a => a.PatientId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<ClinicChair>()
            .WithMany()
            .HasForeignKey(a => a.ChairId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(a => new { a.ClinicId, a.StartAtUtc });
        builder.HasIndex(a => new { a.ClinicId, a.ClinicianUserId, a.StartAtUtc });
        builder.HasIndex(a => new { a.PatientId, a.StartAtUtc });

        // Overlap invariants live in the migration as PostgreSQL EXCLUDE constraints
        // (btree_gist on tstzrange) — see AddSchedulingTables.
    }
}
