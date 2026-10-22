using FluentAssertions;
using MedCanvas.Domain.Common;
using Xunit;

namespace MedCanvas.Domain.Tests;

public class BaseEntityTests
{
    private class TestEntity : BaseEntity
    {
        public TestEntity() { }
        public TestEntity(Guid id, DateTime createdAtUtc) : base(id, createdAtUtc) { }
    }

    [Fact]
    public void Constructor_WithEmptyId_ThrowsArgumentException()
    {
        var act = () => new TestEntity(Guid.Empty, DateTime.UtcNow);
        act.Should().Throw<ArgumentException>().WithParameterName("id");
    }

    [Fact]
    public void SetUpdatedTimestamp_BeforeCreatedAt_ThrowsArgumentException()
    {
        var created = new DateTime(2026, 10, 22, 12, 0, 0, DateTimeKind.Utc);
        var entity = new TestEntity(Guid.NewGuid(), created);

        var earlier = created.AddMinutes(-5);
        var act = () => entity.SetUpdatedTimestamp(earlier);

        act.Should().Throw<ArgumentException>().WithParameterName("updatedAtUtc");
    }

    [Fact]
    public void DefaultConstructor_InitializesEmpty()
    {
        var entity = new TestEntity();
        entity.Id.Should().BeEmpty();
    }
}
