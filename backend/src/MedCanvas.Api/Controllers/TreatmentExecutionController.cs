using MedCanvas.Application.Common.Security;
using MedCanvas.Application.Features.TreatmentExecution;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MedCanvas.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1")]
public sealed class TreatmentExecutionController : ControllerBase
{
    private readonly ISender _sender;

    public TreatmentExecutionController(ISender sender)
    {
        _sender = sender;
    }

    [HttpGet("encounters/{encounterId:guid}/performed-procedures")]
    [Authorize(Policy = Policies.CanReadEncounters)]
    [ProducesResponseType(typeof(IReadOnlyList<PerformedProcedureDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetByEncounter(Guid encounterId, CancellationToken cancellationToken)
    {
        return Ok(await _sender.Send(new GetEncounterPerformedProceduresQuery(encounterId), cancellationToken));
    }

    [HttpGet("patients/{patientId:guid}/performed-procedures")]
    [Authorize(Policy = Policies.CanReadEncounters)]
    [ProducesResponseType(typeof(IReadOnlyList<PerformedProcedureDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetByPatient(Guid patientId, CancellationToken cancellationToken)
    {
        return Ok(await _sender.Send(new GetPatientPerformedProceduresQuery(patientId), cancellationToken));
    }

    [HttpPost("encounters/{encounterId:guid}/performed-procedures")]
    [Authorize(Policy = Policies.CanMutateEncounters)]
    [ProducesResponseType(typeof(PerformedProcedureDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Record(Guid encounterId, [FromBody] RecordPerformedProcedureBody body, CancellationToken cancellationToken)
    {
        var command = new RecordPerformedProcedureCommand(
            encounterId,
            body.CatalogItemId,
            body.IdempotencyKey,
            body.ToothFdi,
            body.Quantity,
            body.ClinicalNote,
            body.TreatmentPlanItemId);

        var result = await _sender.Send(command, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    [HttpPost("performed-procedures/{id:guid}/void")]
    [Authorize(Policy = Policies.CanMutateEncounters)]
    [ProducesResponseType(typeof(PerformedProcedureDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Void(Guid id, [FromBody] VoidPerformedProcedureBody body, CancellationToken cancellationToken)
    {
        return Ok(await _sender.Send(new VoidPerformedProcedureCommand(id, body.Reason), cancellationToken));
    }
}

public sealed record RecordPerformedProcedureBody(
    Guid CatalogItemId,
    string IdempotencyKey,
    string? ToothFdi = null,
    int Quantity = 1,
    string? ClinicalNote = null,
    Guid? TreatmentPlanItemId = null);

public sealed record VoidPerformedProcedureBody(string Reason);
