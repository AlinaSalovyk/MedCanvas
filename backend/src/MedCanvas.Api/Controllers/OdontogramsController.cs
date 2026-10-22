using MedCanvas.Application.Common.Security;
using MedCanvas.Application.Features.Odontograms;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MedCanvas.Api.Controllers;

public sealed record SaveOdontogramRequest(
    string SnapshotJson,
    int? ExpectedVersion = null,
    string? ChangeSummary = null);

public sealed record FinalizeOdontogramRequest(int? ExpectedVersion = null);

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
    [Authorize(Policy = Policies.CanMutateOdontogram)]
    [ProducesResponseType(typeof(OdontogramResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status412PreconditionFailed)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    [ProducesResponseType(StatusCodes.Status428PreconditionRequired)]
    public async Task<IActionResult> Save(
        [FromRoute] Guid encounterId,
        [FromBody] SaveOdontogramRequest request,
        CancellationToken cancellationToken)
    {
        int? expectedVersion = request.ExpectedVersion;

        if (Request.Headers.TryGetValue("If-Match", out var ifMatch) && !string.IsNullOrWhiteSpace(ifMatch))
        {
            var raw = ifMatch.ToString().Trim('\"', ' ');
            if (!int.TryParse(raw, out var parsed))
            {
                return BadRequest(new ProblemDetails
                {
                    Type = "https://medcanvas.health/errors/malformed-etag",
                    Title = "Malformed Precondition",
                    Status = StatusCodes.Status400BadRequest,
                    Detail = "The provided If-Match header value is not a valid integer revision token.",
                    Instance = HttpContext.Request.Path
                });
            }

            if (request.ExpectedVersion.HasValue && request.ExpectedVersion.Value != parsed)
            {
                return BadRequest(new ProblemDetails
                {
                    Type = "https://medcanvas.health/errors/precondition-mismatch",
                    Title = "Precondition Mismatch",
                    Status = StatusCodes.Status400BadRequest,
                    Detail = "The version specified in the If-Match header contradicts the expectedVersion in the request payload.",
                    Instance = HttpContext.Request.Path
                });
            }

            expectedVersion = parsed;
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
    [Authorize(Policy = Policies.CanFinalizeOdontogram)]
    [ProducesResponseType(typeof(OdontogramResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status412PreconditionFailed)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    [ProducesResponseType(StatusCodes.Status428PreconditionRequired)]
    public async Task<IActionResult> Finalize(
        [FromRoute] Guid encounterId,
        [FromBody] FinalizeOdontogramRequest? request,
        CancellationToken cancellationToken)
    {
        int? expectedVersion = request?.ExpectedVersion;

        if (Request.Headers.TryGetValue("If-Match", out var ifMatch) && !string.IsNullOrWhiteSpace(ifMatch))
        {
            var raw = ifMatch.ToString().Trim('\"', ' ');
            if (!int.TryParse(raw, out var parsed))
            {
                return BadRequest(new ProblemDetails
                {
                    Type = "https://medcanvas.health/errors/malformed-etag",
                    Title = "Malformed Precondition",
                    Status = StatusCodes.Status400BadRequest,
                    Detail = "The provided If-Match header value is not a valid integer revision token.",
                    Instance = HttpContext.Request.Path
                });
            }

            if (request?.ExpectedVersion.HasValue == true && request.ExpectedVersion.Value != parsed)
            {
                return BadRequest(new ProblemDetails
                {
                    Type = "https://medcanvas.health/errors/precondition-mismatch",
                    Title = "Precondition Mismatch",
                    Status = StatusCodes.Status400BadRequest,
                    Detail = "The version specified in the If-Match header contradicts the expectedVersion in the request payload.",
                    Instance = HttpContext.Request.Path
                });
            }

            expectedVersion = parsed;
        }

        if (!expectedVersion.HasValue)
        {
            return StatusCode(StatusCodes.Status428PreconditionRequired, new ProblemDetails
            {
                Type = "https://medcanvas.health/errors/precondition-required",
                Title = "Precondition Required",
                Status = StatusCodes.Status428PreconditionRequired,
                Detail = "An If-Match header or expectedVersion property is required to finalize an existing clinical record.",
                Instance = HttpContext.Request.Path
            });
        }

        var command = new FinalizeOdontogramCommand(encounterId, expectedVersion.Value);
        var result = await _sender.Send(command, cancellationToken);
        Response.Headers.ETag = result.ETag;
        return Ok(result);
    }

    [HttpGet("encounters/{encounterId:guid}/odontogram")]
    [Authorize(Policy = Policies.CanReadOdontogram)]
    [ProducesResponseType(typeof(OdontogramResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetByEncounter([FromRoute] Guid encounterId, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new GetOdontogramByEncounterQuery(encounterId), cancellationToken);
        Response.Headers.ETag = result.ETag;
        return Ok(result);
    }

    [HttpGet("patients/{patientId:guid}/odontogram/latest")]
    [Authorize(Policy = Policies.CanReadOdontogram)]
    [ProducesResponseType(typeof(OdontogramResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetLatestByPatient([FromRoute] Guid patientId, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new GetLatestOdontogramByPatientQuery(patientId), cancellationToken);
        Response.Headers.ETag = result.ETag;
        return Ok(result);
    }

    [HttpGet("encounters/{encounterId:guid}/odontogram/revisions")]
    [Authorize(Policy = Policies.CanReadOdontogram)]
    [ProducesResponseType(typeof(IReadOnlyList<OdontogramRevisionDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetRevisions([FromRoute] Guid encounterId, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new GetOdontogramRevisionsQuery(encounterId), cancellationToken);
        return Ok(result);
    }

    [HttpGet("encounters/{encounterId:guid}/fhir")]
    [Authorize(Policy = Policies.CanExportFhir)]
    [Produces("application/fhir+json")]
    [ProducesResponseType(typeof(string), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetFhirBundle([FromRoute] Guid encounterId, CancellationToken cancellationToken)
    {
        var fhirJson = await _sender.Send(new MedCanvas.Application.Features.Fhir.GetEncounterFhirBundleQuery(encounterId), cancellationToken);
        return Content(fhirJson, "application/fhir+json");
    }
}
