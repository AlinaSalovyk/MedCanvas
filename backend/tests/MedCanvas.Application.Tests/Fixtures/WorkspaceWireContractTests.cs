using System.Text.Json;
using FluentAssertions;
using MedCanvas.Application.Features.Billing;
using MedCanvas.Application.Features.Scheduling;
using MedCanvas.Application.Features.TreatmentExecution;
using MedCanvas.Application.Features.TreatmentPlanning;
using MedCanvas.Domain.Enums;
using Xunit;

namespace MedCanvas.Application.Tests.Fixtures;

public class WorkspaceWireContractTests
{
    [Theory]
    [InlineData(typeof(AppointmentDto), "Scheduled")]
    [InlineData(typeof(InvoiceDto), "Issued")]
    [InlineData(typeof(SimulatedPaymentDto), "Recorded")]
    [InlineData(typeof(PerformedProcedureDto), "Recorded")]
    [InlineData(typeof(TreatmentPlanDto), "Draft")]
    public void Status_SerializesAsTheWorkspaceStringContract(Type dto, string initialStatus)
    {
        // Materialize a DTO from its wire representation, then serialize with the
        // same Web defaults used by ASP.NET. No global enum test options hide drift.
        var json = $"{{\"status\":\"{initialStatus}\"}}";
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        var instance = JsonSerializer.Deserialize(json, dto, options);
        var result = JsonSerializer.SerializeToElement(instance, dto, options);
        result.GetProperty("status").GetString().Should().Be(initialStatus);
    }
}
