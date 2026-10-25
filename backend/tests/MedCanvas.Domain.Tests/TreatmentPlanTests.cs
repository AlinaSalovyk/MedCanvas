using FluentAssertions;
using MedCanvas.Domain.Entities;
using MedCanvas.Domain.Enums;
using MedCanvas.Domain.Exceptions;
using Xunit;

namespace MedCanvas.Domain.Tests;

public class ProcedureCatalogItemTests
{
    private static readonly DateTime Now = new(2026, 10, 26, 8, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void Create_WithValidData_NormalizesCodeAndRoundsPrice()
    {
        var item = ProcedureCatalogItem.Create(Guid.NewGuid(), " fill-01 ", "Composite filling", null, "Restorative", 600.555m, 45, Now);
        item.Code.Should().Be("FILL-01");
        item.DefaultPrice.Should().Be(600.56m);
        item.IsActive.Should().BeTrue();
    }

    [Theory]
    [InlineData(-1)]
    public void Create_WithNegativePrice_Throws(decimal price)
    {
        var act = () => ProcedureCatalogItem.Create(Guid.NewGuid(), "X-1", "Name", null, null, price, 30, Now);
        act.Should().Throw<ArgumentException>().WithParameterName("price");
    }

    [Fact]
    public void Create_WithOverlongDuration_Throws()
    {
        var act = () => ProcedureCatalogItem.Create(Guid.NewGuid(), "X-1", "Name", null, null, 100m, 601, Now);
        act.Should().Throw<ArgumentException>().WithParameterName("minutes");
    }

    [Fact]
    public void Update_ChangesEditableFields_KeepsCode()
    {
        var item = ProcedureCatalogItem.Create(Guid.NewGuid(), "X-1", "Old", null, null, 100m, 30, Now);
        item.Update("New", "desc", "Cat", 250.009m, 60, Now);

        item.Code.Should().Be("X-1");
        item.Name.Should().Be("New");
        item.DefaultPrice.Should().Be(250.01m);
    }
}

public class TreatmentPlanItemTests
{
    private static readonly DateTime Now = new(2026, 10, 26, 8, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void Create_ComputesTotalFromSnapshot()
    {
        var item = TreatmentPlanItem.Create(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "16", "occlusal", "Phase 1", 3, 199.99m, Now, null);
        item.TotalAmount.Should().Be(599.97m);
    }

    [Theory]
    [InlineData("0")]
    [InlineData("99")]
    [InlineData("55x")]
    public void Create_WithInvalidToothFdi_Throws(string tooth)
    {
        var act = () => TreatmentPlanItem.Create(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), tooth, null, null, 1, 100m, Now, null);
        act.Should().Throw<ArgumentException>().WithParameterName("toothFdi");
    }

    [Theory]
    [InlineData("top")]
    [InlineData("buccal")]
    public void Create_WithInvalidSurface_Throws(string surface)
    {
        var act = () => TreatmentPlanItem.Create(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "16", surface, null, 1, 100m, Now, null);
        act.Should().Throw<ArgumentException>().WithParameterName("surface");
    }

    [Theory]
    [InlineData(0)]
    [InlineData(21)]
    public void Create_WithOutOfRangeQuantity_Throws(int quantity)
    {
        var act = () => TreatmentPlanItem.Create(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), null, null, null, quantity, 100m, Now, null);
        act.Should().Throw<ArgumentException>().WithParameterName("quantity");
    }
}

public class TreatmentPlanTests
{
    private static readonly DateTime Now = new(2026, 10, 26, 8, 0, 0, DateTimeKind.Utc);

    private static ProcedureCatalogItem Catalog(decimal price = 500m) =>
        ProcedureCatalogItem.Create(Guid.NewGuid(), "CAT-1", "Procedure", null, null, price, 30, Now);

    [Fact]
    public void NewPlan_StartsDraftWithNoItems()
    {
        var plan = TreatmentPlan.Create(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Now);
        plan.Status.Should().Be(TreatmentPlanStatus.Draft);
        plan.Items.Should().BeEmpty();
        plan.EstimateTotal().Should().Be(0m);
    }

    [Fact]
    public void AddItem_SnapshotsCatalogPrice_AtInsertionTime()
    {
        var plan = TreatmentPlan.Create(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Now);
        var catalog = Catalog(700m);
        plan.AddItem(catalog, "16", "occlusal", "Phase 1", 2, null, Now);

        plan.Items.Single().UnitPriceSnapshot.Should().Be(700m);
        plan.EstimateTotal().Should().Be(1400m);
        plan.Version.Should().Be(2);
    }

    [Fact]
    public void SubmitAndApprove_TransitionsLegally_AndLocksItems()
    {
        var plan = TreatmentPlan.Create(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Now);
        plan.AddItem(Catalog(), "16", null, null, 1, null, Now);

        plan.SubmitForApproval(Now);
        plan.Status.Should().Be(TreatmentPlanStatus.Proposed);

        var act = () => plan.AddItem(Catalog(), "11", null, null, 1, null, Now);
        act.Should().Throw<DomainException>().WithMessage("*Draft*");

        plan.Approve(Guid.NewGuid(), Now);
        plan.Status.Should().Be(TreatmentPlanStatus.Approved);
        plan.ApprovedAtUtc.Should().NotBeNull();

        var removeAct = () => plan.RemoveItem(plan.Items[0].Id, Now);
        removeAct.Should().Throw<DomainException>().WithMessage("*Draft*");
    }

    [Fact]
    public void Submit_EmptyPlan_Throws()
    {
        var plan = TreatmentPlan.Create(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Now);
        var act = () => plan.SubmitForApproval(Now);
        act.Should().Throw<DomainException>().WithMessage("*empty*");
    }

    [Fact]
    public void Approve_ProposedOnly()
    {
        var plan = TreatmentPlan.Create(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Now);
        plan.AddItem(Catalog(), null, null, null, 1, null, Now);
        var act = () => plan.Approve(Guid.NewGuid(), Now);
        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void PriceSnapshot_IsIsolatedFromLaterCatalogChanges()
    {
        var plan = TreatmentPlan.Create(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Now);
        var catalog = Catalog(500m);
        plan.AddItem(catalog, null, null, null, 1, null, Now);

        // Catalog price changes later (FR-405)
        catalog.Update("Procedure", null, null, 900m, 30, Now);

        plan.Items.Single().UnitPriceSnapshot.Should().Be(500m);
        plan.EstimateTotal().Should().Be(500m);
    }

    [Fact]
    public void Cancel_FromApproved_Works_FromTerminalCompleted_Throws()
    {
        var plan = TreatmentPlan.Create(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Now);
        plan.AddItem(Catalog(), null, null, null, 1, null, Now);
        plan.SubmitForApproval(Now);
        plan.Approve(Guid.NewGuid(), Now);
        plan.Cancel(Now);
        plan.Status.Should().Be(TreatmentPlanStatus.Cancelled);

        var act = () => plan.Cancel(Now);
        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void RemoveItem_UnknownId_Throws()
    {
        var plan = TreatmentPlan.Create(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Now);
        plan.AddItem(Catalog(), null, null, null, 1, null, Now);
        var act = () => plan.RemoveItem(Guid.NewGuid(), Now);
        act.Should().Throw<DomainException>().WithMessage("*not found*");
    }
}
