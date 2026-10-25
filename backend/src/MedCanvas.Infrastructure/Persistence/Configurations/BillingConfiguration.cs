using MedCanvas.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MedCanvas.Infrastructure.Persistence.Configurations;

public sealed class InvoiceConfiguration : IEntityTypeConfiguration<Invoice>
{
    public void Configure(EntityTypeBuilder<Invoice> builder)
    {
        builder.ToTable("Invoices");

        builder.HasKey(i => i.Id);

        builder.Property(i => i.ClinicId).IsRequired();
        builder.Property(i => i.PatientId).IsRequired();
        builder.Property(i => i.EncounterId).IsRequired();
        builder.Property(i => i.InvoiceNumber).IsRequired().HasMaxLength(50);
        builder.Property(i => i.TotalAmount).IsRequired().HasPrecision(12, 2);
        builder.Property(i => i.Currency).IsRequired().HasMaxLength(3);
        builder.Property(i => i.Status).IsRequired().HasConversion<string>().HasMaxLength(30);
        builder.Property(i => i.CreatedByUserId).IsRequired();
        builder.Property(i => i.VoidedAtUtc);
        builder.Property(i => i.VoidReason).HasMaxLength(500);

        builder.HasMany(i => i.Payments)
            .WithOne()
            .HasForeignKey(p => p.InvoiceId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<Clinic>()
            .WithMany()
            .HasForeignKey(i => i.ClinicId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<Patient>()
            .WithMany()
            .HasForeignKey(i => i.PatientId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<DentalEncounter>()
            .WithMany()
            .HasForeignKey(i => i.EncounterId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(i => i.InvoiceNumber).IsUnique();
        builder.HasIndex(i => new { i.ClinicId, i.PatientId });
    }
}

public sealed class SimulatedPaymentConfiguration : IEntityTypeConfiguration<SimulatedPayment>
{
    public void Configure(EntityTypeBuilder<SimulatedPayment> builder)
    {
        builder.ToTable("SimulatedPayments");

        builder.HasKey(p => p.Id);

        builder.Property(p => p.ClinicId).IsRequired();
        builder.Property(p => p.InvoiceId).IsRequired();
        builder.Property(p => p.Amount).IsRequired().HasPrecision(12, 2);
        builder.Property(p => p.MethodLabel).IsRequired().HasMaxLength(100);
        builder.Property(p => p.IdempotencyKey).IsRequired().HasMaxLength(100);
        builder.Property(p => p.IsSimulation).IsRequired();
        builder.Property(p => p.Status).IsRequired().HasConversion<string>().HasMaxLength(20);
        builder.Property(p => p.VoidReason).HasMaxLength(500);
        builder.Property(p => p.RecordedByUserId).IsRequired();

        builder.HasOne<Clinic>()
            .WithMany()
            .HasForeignKey(p => p.ClinicId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(p => new { p.ClinicId, p.IdempotencyKey }).IsUnique();
    }
}
