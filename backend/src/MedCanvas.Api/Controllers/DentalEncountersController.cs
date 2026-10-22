using MedCanvas.Application.Features.Encounters;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MedCanvas.Api.Controllers;

public sealed record CancelEncounterRequest(string Reason);

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
    [ProducesResponseType(typeof(EncounterDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Start([FromBody] StartEncounterCommand command, CancellationToken cancellationToken)
    {
        var encounter = await _sender.Send(command, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = encounter.Id }, encounter);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(EncounterDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById([FromRoute] Guid id, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new GetEncounterByIdQuery(id), cancellationToken);
        return Ok(result);
    }

    [HttpGet("by-patient/{patientId:guid}")]
    [ProducesResponseType(typeof(IReadOnlyList<EncounterDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetByPatient([FromRoute] Guid patientId, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new GetPatientEncountersQuery(patientId), cancellationToken);
        return Ok(result);
    }

    [HttpPost("{id:guid}/complete")]
    [ProducesResponseType(typeof(EncounterDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Complete([FromRoute] Guid id, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new CompleteEncounterCommand(id), cancellationToken);
        return Ok(result);
    }

    [HttpPost("{id:guid}/cancel")]
    [ProducesResponseType(typeof(EncounterDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Cancel(
        [FromRoute] Guid id,
        [FromBody] CancelEncounterRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new CancelEncounterCommand(id, request.Reason), cancellationToken);
        return Ok(result);
    }
}
