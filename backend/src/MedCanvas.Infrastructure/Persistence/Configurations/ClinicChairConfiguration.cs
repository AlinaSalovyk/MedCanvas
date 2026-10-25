using MedCanvas.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MedCanvas.Infrastructure.Persistence.Configurations;

public sealed class ClinicChairConfiguration : IEntityTypeConfiguration<ClinicChair>
{
    public void Configure(EntityTypeBuilder<ClinicChair> builder)
    {
        builder.ToTable("ClinicChairs");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.ClinicId).IsRequired();
        builder.Property(c => c.Name).IsRequired().HasMaxLength(100);
        builder.Property(c => c.IsActive).IsRequired();
        builder.Property(c => c.CreatedAtUtc).IsRequired();
        builder.Property(c => c.UpdatedAtUtc).IsRequired();

        builder.HasOne<Clinic>()
            .WithMany()
            .HasForeignKey(c => c.ClinicId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(c => new { c.ClinicId, c.Name }).IsUnique();
    }
}

public sealed class ProviderAvailabilityConfiguration : IEntityTypeConfiguration<ProviderAvailability>
{
    public void Configure(EntityTypeBuilder<ProviderAvailability> builder)
    {
        builder.ToTable("ProviderAvailabilities");

        builder.HasKey(a => a.Id);

        builder.Property(a => a.ClinicId).IsRequired();
        builder.Property(a => a.ClinicianUserId).IsRequired();
        builder.Property(a => a.DayOfWeek).IsRequired();
        builder.Property(a => a.StartTime).IsRequired();
        builder.Property(a => a.EndTime).IsRequired();
        builder.Property(a => a.CreatedAtUtc).IsRequired();
        builder.Property(a => a.UpdatedAtUtc).IsRequired();

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(a => a.ClinicianUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(a => new { a.ClinicId, a.ClinicianUserId, a.DayOfWeek });
    }
}

public sealed class ProviderAvailabilityBreakConfiguration : IEntityTypeConfiguration<ProviderAvailabilityBreak>
{
    public void Configure(EntityTypeBuilder<ProviderAvailabilityBreak> builder)
    {
        builder.ToTable("ProviderAvailabilityBreaks");

        builder.HasKey(b => b.Id);

        builder.Property(b => b.ProviderAvailabilityId).IsRequired();
        builder.Property(b => b.StartTime).IsRequired();
        builder.Property(b => b.EndTime).IsRequired();

        builder.HasOne<ProviderAvailability>()
            .WithMany()
            .HasForeignKey(b => b.ProviderAvailabilityId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class ProviderAvailabilityExceptionConfiguration : IEntityTypeConfiguration<ProviderAvailabilityException>
{
    public void Configure(EntityTypeBuilder<ProviderAvailabilityException> builder)
    {
        builder.ToTable("ProviderAvailabilityExceptions");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.ClinicId).IsRequired();
        builder.Property(e => e.ClinicianUserId).IsRequired();
        builder.Property(e => e.Date).IsRequired();
        builder.Property(e => e.IsWorkingDay).IsRequired();

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(e => e.ClinicianUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(e => new { e.ClinicId, e.ClinicianUserId, e.Date }).IsUnique();
    }
}
