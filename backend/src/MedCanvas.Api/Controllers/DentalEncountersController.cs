using MedCanvas.Application.Common.Security;
using MedCanvas.Application.Features.Encounters;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MedCanvas.Api.Controllers;

public sealed record CancelEncounterRequest(string? Reason = null);

public sealed record CompleteEncounterRequest(string? ClinicalSummary = null);

[ApiController]
[Authorize]
[Route("api/v1/encounters")]
public sealed class DentalEncountersController : ControllerBase
{
    private readonly ISender _sender;

    public DentalEncountersController(ISender sender)
    {
        _sender = sender;
    }

    [HttpPost]
    [Authorize(Policy = Policies.CanMutateEncounters)]
    [ProducesResponseType(typeof(EncounterDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Start([FromBody] StartEncounterCommand command, CancellationToken cancellationToken)
    {
        var encounter = await _sender.Send(command, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = encounter.Id }, encounter);
    }

    [HttpGet("{id:guid}")]
    [Authorize(Policy = Policies.CanReadEncounters)]
    [ProducesResponseType(typeof(EncounterDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById([FromRoute] Guid id, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new GetEncounterByIdQuery(id), cancellationToken);
        return Ok(result);
    }

    [HttpGet("by-patient/{patientId:guid}")]
    [Authorize(Policy = Policies.CanReadEncounters)]
    [ProducesResponseType(typeof(IReadOnlyList<EncounterDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetByPatient([FromRoute] Guid patientId, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new GetPatientEncountersQuery(patientId), cancellationToken);
        return Ok(result);
    }

    [HttpPost("{id:guid}/complete")]
    [Authorize(Policy = Policies.CanMutateEncounters)]
    [ProducesResponseType(typeof(EncounterDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Complete(
        [FromRoute] Guid id,
        [FromBody] CompleteEncounterRequest? request,
        CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new CompleteEncounterCommand(id), cancellationToken);
        return Ok(result);
    }

    [HttpPost("{id:guid}/cancel")]
    [Authorize(Policy = Policies.CanMutateEncounters)]
    [ProducesResponseType(typeof(EncounterDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Cancel(
        [FromRoute] Guid id,
        [FromBody] CancelEncounterRequest? request,
        CancellationToken cancellationToken)
    {
        var reason = !string.IsNullOrWhiteSpace(request?.Reason) ? request.Reason : "Encounter cancelled";
        var result = await _sender.Send(new CancelEncounterCommand(id, reason), cancellationToken);
        return Ok(result);
    }
}
