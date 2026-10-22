using MedCanvas.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MedCanvas.Infrastructure.Persistence.Configurations;

public sealed class ClinicMembershipConfiguration : IEntityTypeConfiguration<ClinicMembership>
{
    public void Configure(EntityTypeBuilder<ClinicMembership> builder)
    {
        builder.ToTable("ClinicMemberships");

        builder.HasKey(cm => cm.Id);

        builder.Property(cm => cm.ClinicId)
            .IsRequired();

        builder.Property(cm => cm.UserId)
            .IsRequired();

        builder.Property(cm => cm.Role)
            .IsRequired()
            .HasConversion<string>()
            .HasMaxLength(50);

        builder.Property(cm => cm.IsActive)
            .IsRequired();

        builder.Property(cm => cm.CreatedAtUtc)
            .IsRequired();

        builder.Property(cm => cm.UpdatedAtUtc)
            .IsRequired();

        builder.HasIndex(cm => new { cm.ClinicId, cm.UserId })
            .IsUnique();

        builder.HasOne<Clinic>()
            .WithMany()
            .HasForeignKey(cm => cm.ClinicId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(cm => cm.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
