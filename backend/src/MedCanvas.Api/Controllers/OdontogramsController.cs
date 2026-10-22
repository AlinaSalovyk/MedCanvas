using MedCanvas.Application.Features.Odontograms;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MedCanvas.Api.Controllers;

public sealed record SaveOdontogramRequest(
    string SnapshotJson,
    int? ExpectedVersion = null,
    string? ChangeSummary = null);

public sealed record FinalizeOdontogramRequest(int ExpectedVersion);

[ApiController]
[Authorize]
[Route("api/v1")]
public sealed class OdontogramsController : ControllerBase
{
    private readonly ISender _sender;

    public OdontogramsController(ISender sender)
    {
        _sender = sender;
    }

    [HttpPut("encounters/{encounterId:guid}/odontogram")]
    [ProducesResponseType(typeof(OdontogramResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status412PreconditionFailed)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> Save(
        [FromRoute] Guid encounterId,
        [FromBody] SaveOdontogramRequest request,
        CancellationToken cancellationToken)
    {
        int? expectedVersion = request.ExpectedVersion;

        if (Request.Headers.TryGetValue("If-Match", out var ifMatch) && !string.IsNullOrWhiteSpace(ifMatch))
        {
            var raw = ifMatch.ToString().Trim('\"', ' ');
            if (int.TryParse(raw, out var parsed))
            {
                expectedVersion = parsed;
            }
        }

        var command = new SaveOdontogramCommand(
            encounterId,
            request.SnapshotJson,
            expectedVersion,
            request.ChangeSummary);

        var result = await _sender.Send(command, cancellationToken);
        Response.Headers.ETag = result.ETag;
        return Ok(result);
    }

    [HttpPost("encounters/{encounterId:guid}/odontogram/finalize")]
    [ProducesResponseType(typeof(OdontogramResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status412PreconditionFailed)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> Finalize(
        [FromRoute] Guid encounterId,
        [FromBody] FinalizeOdontogramRequest request,
        CancellationToken cancellationToken)
    {
        var expectedVersion = request.ExpectedVersion;

        if (Request.Headers.TryGetValue("If-Match", out var ifMatch) && !string.IsNullOrWhiteSpace(ifMatch))
        {
            var raw = ifMatch.ToString().Trim('\"', ' ');
            if (int.TryParse(raw, out var parsed))
            {
                expectedVersion = parsed;
            }
        }

        var command = new FinalizeOdontogramCommand(encounterId, expectedVersion);
        var result = await _sender.Send(command, cancellationToken);
        Response.Headers.ETag = result.ETag;
        return Ok(result);
    }

    [HttpGet("encounters/{encounterId:guid}/odontogram")]
    [ProducesResponseType(typeof(OdontogramResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetByEncounter([FromRoute] Guid encounterId, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new GetOdontogramByEncounterQuery(encounterId), cancellationToken);
        Response.Headers.ETag = result.ETag;
        return Ok(result);
    }

    [HttpGet("patients/{patientId:guid}/odontogram/latest")]
    [ProducesResponseType(typeof(OdontogramResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetLatestByPatient([FromRoute] Guid patientId, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new GetLatestOdontogramByPatientQuery(patientId), cancellationToken);
        Response.Headers.ETag = result.ETag;
        return Ok(result);
    }

    [HttpGet("encounters/{encounterId:guid}/odontogram/revisions")]
    [ProducesResponseType(typeof(IReadOnlyList<OdontogramRevisionDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetRevisions([FromRoute] Guid encounterId, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new GetOdontogramRevisionsQuery(encounterId), cancellationToken);
        return Ok(result);
    }
}
