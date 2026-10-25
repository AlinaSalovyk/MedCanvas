using MedCanvas.Api.Common;
using MedCanvas.Application.Common.Models;
using MedCanvas.Application.Common.Security;
using MedCanvas.Application.Features.Encounters;
using MedCanvas.Application.Features.Patients;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MedCanvas.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/patients")]
public sealed class PatientsController : ControllerBase
{
    private readonly ISender _sender;

    public PatientsController(ISender sender)
    {
        _sender = sender;
    }

    [HttpPost]
    [Authorize(Policy = Policies.CanMutatePatients)]
    [ProducesResponseType(typeof(PatientDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Create([FromBody] CreatePatientCommand command, CancellationToken cancellationToken)
    {
        var patient = await _sender.Send(command, cancellationToken);
        Response.Headers.ETag = $"\"{patient.ConcurrencyVersion}\"";
        return CreatedAtAction(nameof(GetById), new { id = patient.Id }, patient);
    }

    [HttpGet]
    [Authorize(Policy = Policies.CanReadPatients)]
    [ProducesResponseType(typeof(PagedResult<PatientDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search,
        [FromQuery] string? searchTerm,
        [FromQuery] int? page,
        [FromQuery] int? pageNumber,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? sortBy = null,
        [FromQuery] bool sortDescending = false,
        [FromQuery] bool includeArchived = false,
        CancellationToken cancellationToken = default)
    {
        var effectiveSearch = !string.IsNullOrWhiteSpace(searchTerm) ? searchTerm : search;
        var effectivePage = pageNumber ?? page ?? 1;
        var query = new GetPatientsQuery(effectiveSearch, effectivePage, pageSize, sortBy, sortDescending, includeArchived);
        var result = await _sender.Send(query, cancellationToken);
        return Ok(result);
    }

    [HttpGet("duplicates")]
    [Authorize(Policy = Policies.CanReadPatients)]
    [ProducesResponseType(typeof(IReadOnlyList<PatientDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetDuplicates(
        [FromQuery] string? firstName,
        [FromQuery] string? lastName,
        [FromQuery] DateOnly? dateOfBirth,
        [FromQuery] string? externalMedicalRecordNumber,
        CancellationToken cancellationToken = default)
    {
        var result = await _sender.Send(
            new GetPatientDuplicatesQuery(firstName, lastName, dateOfBirth, externalMedicalRecordNumber),
            cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    [Authorize(Policy = Policies.CanReadPatients)]
    [ProducesResponseType(typeof(PatientDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById([FromRoute] Guid id, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new GetPatientByIdQuery(id), cancellationToken);
        Response.Headers.ETag = $"\"{result.ConcurrencyVersion}\"";
        return Ok(result);
    }

    [HttpGet("{id:guid}/encounters")]
    [Authorize(Policy = Policies.CanReadPatients)]
    [ProducesResponseType(typeof(IReadOnlyList<EncounterDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetEncounters([FromRoute] Guid id, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new GetPatientEncountersQuery(id), cancellationToken);
        return Ok(result);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = Policies.CanMutatePatients)]
    [ProducesResponseType(typeof(PatientDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status412PreconditionFailed)]
    [ProducesResponseType(StatusCodes.Status428PreconditionRequired)]
    public async Task<IActionResult> Update(
        [FromRoute] Guid id,
        [FromBody] UpdatePatientCommand command,
        CancellationToken cancellationToken)
    {
        if (id != command.Id)
        {
            return BadRequest(new ProblemDetails
            {
                Type = "https://medcanvas.health/errors/route-mismatch",
                Title = "Route Mismatch",
                Status = StatusCodes.Status400BadRequest,
                Detail = "The path ID does not match the command payload ID.",
                Instance = HttpContext.Request.Path
            });
        }

        var (isValid, expectedVersion, problem) = IfMatchPreconditionParser.ParseIfMatchHeader(
            Request.Headers,
            HttpContext.Request.Path,
            command.ExpectedVersion);

        if (!isValid)
        {
            return BadRequest(problem);
        }

        var updateCommand = command with { ExpectedVersion = expectedVersion };
        var result = await _sender.Send(updateCommand, cancellationToken);
        Response.Headers.ETag = $"\"{result.ConcurrencyVersion}\"";
        return Ok(result);
    }

    [HttpPost("{id:guid}/archive")]
    [Authorize(Policy = Policies.CanMutatePatients)]
    [ProducesResponseType(typeof(PatientDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Archive([FromRoute] Guid id, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new ArchivePatientCommand(id), cancellationToken);
        Response.Headers.ETag = $"\"{result.ConcurrencyVersion}\"";
        return Ok(result);
    }

    [HttpPost("{id:guid}/restore")]
    [Authorize(Policy = Policies.CanMutatePatients)]
    [ProducesResponseType(typeof(PatientDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Restore([FromRoute] Guid id, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new RestorePatientCommand(id), cancellationToken);
        Response.Headers.ETag = $"\"{result.ConcurrencyVersion}\"";
        return Ok(result);
    }
}
