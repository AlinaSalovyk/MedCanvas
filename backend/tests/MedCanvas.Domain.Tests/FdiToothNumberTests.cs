using FluentAssertions;
using MedCanvas.Domain.Exceptions;
using MedCanvas.Domain.ValueObjects;
using Xunit;

namespace MedCanvas.Domain.Tests;

public class FdiToothNumberTests
{
    [Theory]
    [InlineData(18, 1, 8, true, false, true, false, false)]
    [InlineData(11, 1, 1, true, false, false, false, true)]
    [InlineData(24, 2, 4, true, false, false, true, false)]
    [InlineData(36, 3, 6, false, true, true, false, false)]
    [InlineData(43, 4, 3, false, true, false, false, true)]
    public void From_ValidPermanentNumber_SetsAnatomicalProperties(
        int number,
        int expectedQuadrant,
        int expectedPosition,
        bool expectedUpper,
        bool expectedLower,
        bool expectedMolar,
        bool expectedPremolar,
        bool expectedAnterior)
    {
        var tooth = FdiToothNumber.From(number);

        tooth.Number.Should().Be(number);
        tooth.Key.Should().Be(number.ToString());
        tooth.Quadrant.Should().Be(expectedQuadrant);
        tooth.Position.Should().Be(expectedPosition);
        tooth.IsUpper.Should().Be(expectedUpper);
        tooth.IsLower.Should().Be(expectedLower);
        tooth.IsMolar.Should().Be(expectedMolar);
        tooth.IsPremolar.Should().Be(expectedPremolar);
        tooth.IsAnterior.Should().Be(expectedAnterior);
    }

    [Fact]
    public void AllPermanentNumbers_ContainsExactly32Teeth()
    {
        var all = FdiToothNumber.AllPermanentNumbers;
        all.Should().HaveCount(32);
        all.Should().Contain([18, 11, 21, 28, 31, 38, 41, 48]);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(99)]
    [InlineData(10)]
    [InlineData(29)]
    [InlineData(51)] // Milk tooth position 51 - invalid as top-level FDI key in MedCanvas!
    [InlineData(55)]
    [InlineData(61)]
    [InlineData(71)]
    [InlineData(85)]
    public void From_InvalidNumber_ThrowsInvalidFdiCoordinateException(int invalidNumber)
    {
        var act = () => FdiToothNumber.From(invalidNumber);
        act.Should().Throw<InvalidFdiCoordinateException>()
            .Which.ToothKey.Should().Be(invalidNumber.ToString());
    }

    [Theory]
    [InlineData("18", true)]
    [InlineData("36", true)]
    [InlineData("51", false)]
    [InlineData("invalid", false)]
    [InlineData("", false)]
    public void TryParse_ReturnsExpectedResult(string key, bool expectedSuccess)
    {
        var success = FdiToothNumber.TryParse(key, out var tooth);

        success.Should().Be(expectedSuccess);
        if (expectedSuccess)
        {
            tooth.Should().NotBeNull();
            tooth!.Key.Should().Be(key);
        }
        else
        {
            tooth.Should().BeNull();
        }
    }

    [Fact]
    public void Equals_WithSameNumber_ReturnsTrue()
    {
        var t1 = FdiToothNumber.From(16);
        var t2 = FdiToothNumber.From("16");

        t1.Should().Be(t2);
        (t1 == t2).Should().BeTrue();
        (t1 != t2).Should().BeFalse();
        t1.GetHashCode().Should().Be(t2.GetHashCode());
    }
}
