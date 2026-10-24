using System.Text.Json;
using FluentAssertions;
using MedCanvas.Tests.Data;
using Xunit;

namespace MedCanvas.Application.Tests.Fixtures;

public class ClinicalPayloadFixturesTests
{
    [Fact]
    public void GeneratedFixtures_AllExistAndAreValidJson()
    {
        var fixtures = new[]
        {
            ClinicalPayloadFixtures.EmptyChartPayload,
            ClinicalPayloadFixtures.CariesAndRestorationsPayload,
            ClinicalPayloadFixtures.StatusAndPlanPayload,
            ClinicalPayloadFixtures.ImplantsAndMissingTeethPayload,
            ClinicalPayloadFixtures.PrimaryAndMixedDentitionPayload,
            ClinicalPayloadFixtures.EndodonticsPayload,
            ClinicalPayloadFixtures.PeriodontalPayload,
            ClinicalPayloadFixtures.CaseMetadataPayload,
            ClinicalPayloadFixtures.PluginCustomStatesPayload
        };

        foreach (var fixture in fixtures)
        {
            fixture.Should().NotBeNullOrWhiteSpace();
            using var doc = JsonDocument.Parse(fixture);
            doc.RootElement.GetProperty("version").GetString().Should().Be("2.22");
            doc.RootElement.TryGetProperty("teeth", out var teeth).Should().BeTrue();
            teeth.ValueKind.Should().Be(JsonValueKind.Object);
        }
    }

    [Fact]
    public void CariesAndRestorations_HasExpectedArrayAndSeverity()
    {
        using var doc = JsonDocument.Parse(ClinicalPayloadFixtures.CariesAndRestorationsPayload);
        var t11 = doc.RootElement.GetProperty("teeth").GetProperty("11");

        t11.GetProperty("caries").ValueKind.Should().Be(JsonValueKind.Array);
        var cariesList = t11.GetProperty("caries").EnumerateArray().Select(e => e.GetString()).ToList();
        cariesList.Should().Contain("caries-distal");
        cariesList.Should().Contain("caries-mesial");

        var severity = t11.GetProperty("cariesSeverity");
        severity.GetProperty("distal").GetInt32().Should().Be(3);
        severity.GetProperty("mesial").GetInt32().Should().Be(2);
    }

    [Fact]
    public void StatusAndPlan_HasSeparateStatusAndPlanObjects()
    {
        using var doc = JsonDocument.Parse(ClinicalPayloadFixtures.StatusAndPlanPayload);
        doc.RootElement.TryGetProperty("teeth", out var statusTeeth).Should().BeTrue();
        doc.RootElement.TryGetProperty("plan", out var planTeeth).Should().BeTrue();

        statusTeeth.TryGetProperty("11", out var t11Status).Should().BeTrue();
        planTeeth.TryGetProperty("11", out var t11Plan).Should().BeTrue();

        t11Status.GetProperty("caries").GetArrayLength().Should().BeGreaterThan(0);
        t11Plan.GetProperty("fillingSurfaces").GetArrayLength().Should().BeGreaterThan(0);
    }
}
