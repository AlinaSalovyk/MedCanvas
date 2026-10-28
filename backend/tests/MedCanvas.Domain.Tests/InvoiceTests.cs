using FluentAssertions;
using MedCanvas.Domain.Entities;
using MedCanvas.Domain.Enums;
using MedCanvas.Domain.Exceptions;
using Xunit;

namespace MedCanvas.Domain.Tests;

public class InvoiceTests
{
    private static readonly DateTime Now = new(2026, 10, 28, 12, 0, 0, DateTimeKind.Utc);

    private static (Invoice Invoice, PerformedProcedure Procedure, ProcedureCatalogItem Catalog) Issue()
    {
        var clinicId = Guid.NewGuid();
        var catalog = ProcedureCatalogItem.Create(clinicId, "DEMO", "Original", null, null, 1000, 30, Now);
        var procedure = PerformedProcedure.Record(clinicId, Guid.NewGuid(), Guid.NewGuid(), null, catalog.Id,
            "11", 1, Guid.NewGuid(), 1000, null, "procedure", Now);
        var invoice = Invoice.Issue(clinicId, procedure.PatientId, procedure.EncounterId, "INV-DEMO", [procedure],
            new Dictionary<Guid, ProcedureCatalogItem> { [catalog.Id] = catalog }, Guid.NewGuid(), Now);
        return (invoice, procedure, catalog);
    }

    [Fact]
    public void Issue_CapturesImmutableDescriptionAndPrice()
    {
        var (invoice, procedure, catalog) = Issue();
        catalog.Update("Changed", null, null, 2500, 30, Now);
        procedure.Void(Guid.NewGuid(), "Correction", Now);
        invoice.HasLineSnapshot.Should().BeTrue();
        invoice.Items.Should().ContainSingle().Which.DescriptionSnapshot.Should().Be("Original");
        invoice.Items[0].UnitPriceSnapshot.Should().Be(1000);
        invoice.Items.Sum(i => i.TotalAmount).Should().Be(invoice.TotalAmount);
    }

    [Fact]
    public void Issue_RejectsDuplicateOrForeignProcedures()
    {
        var (invoice, procedure, catalog) = Issue();
        var catalogs = new Dictionary<Guid, ProcedureCatalogItem> { [catalog.Id] = catalog };
        var duplicate = () => Invoice.Issue(invoice.ClinicId, invoice.PatientId, invoice.EncounterId, "INV-2",
            [procedure, procedure], catalogs, Guid.NewGuid(), Now);
        duplicate.Should().Throw<DomainException>();
        var foreign = () => Invoice.Issue(Guid.NewGuid(), invoice.PatientId, invoice.EncounterId, "INV-3",
            [procedure], catalogs, Guid.NewGuid(), Now);
        foreign.Should().Throw<DomainException>();
    }

    [Fact]
    public void Payments_RejectWrongOwnerDuplicateAndOverpayment()
    {
        var (invoice, _, _) = Issue();
        var wrong = SimulatedPayment.Record(Guid.NewGuid(), invoice.Id, 100, "Demo", "key", Guid.NewGuid(), Now);
        var invalid = () => invoice.AddSimulatedPayment(wrong, Now);
        invalid.Should().Throw<DomainException>();
        var payment = SimulatedPayment.Record(invoice.ClinicId, invoice.Id, 700, "Demo", "key", Guid.NewGuid(), Now);
        invoice.AddSimulatedPayment(payment, Now);
        var repeated = () => invoice.AddSimulatedPayment(payment, Now);
        repeated.Should().Throw<DomainException>();
        var excess = () => invoice.AddSimulatedPayment(SimulatedPayment.Record(invoice.ClinicId, invoice.Id,
            700, "Demo", "different", Guid.NewGuid(), Now), Now);
        excess.Should().Throw<DomainException>();
        invoice.SimulatedPaid().Should().Be(700);
        invoice.Status.Should().Be(InvoiceStatus.PartiallySimulated);
        var voidPaid = () => invoice.Void("Correction", Guid.NewGuid(), Now);
        voidPaid.Should().Throw<DomainException>();
    }

    [Theory]
    [InlineData("0.001")]
    [InlineData("999999.01")]
    [InlineData("0")]
    [InlineData("-0.01")]
    public void Payment_RejectsInvalidPrecisionAndBounds(string amount)
    {
        var create = () => SimulatedPayment.Record(Guid.NewGuid(), Guid.NewGuid(),
            decimal.Parse(amount, System.Globalization.CultureInfo.InvariantCulture), "Demo", "key", Guid.NewGuid(), Now);
        create.Should().Throw<ArgumentException>();
    }
}
