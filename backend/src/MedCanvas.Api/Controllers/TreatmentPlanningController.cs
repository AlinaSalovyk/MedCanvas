using MedCanvas.Application.Common.Security;
using MedCanvas.Application.Features.TreatmentPlanning;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MedCanvas.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/catalog")]
public sealed class CatalogController : ControllerBase
{
    private readonly ISender _sender;

    public CatalogController(ISender sender)
    {
        _sender = sender;
    }

    [HttpGet]
    [Authorize(Policy = Policies.CanReadClinicProfile)]
    [ProducesResponseType(typeof(IReadOnlyList<CatalogItemDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(CancellationToken cancellationToken)
    {
        return Ok(await _sender.Send(new GetCatalogItemsQuery(), cancellationToken));
    }

    [HttpPost]
    [Authorize(Policy = Policies.CanManageClinic)]
    [ProducesResponseType(typeof(CatalogItemDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create([FromBody] CreateCatalogItemCommand command, CancellationToken cancellationToken)
    {
        var item = await _sender.Send(command, cancellationToken);
        return CreatedAtAction(nameof(GetAll), new { id = item.Id }, item);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = Policies.CanManageClinic)]
    [ProducesResponseType(typeof(CatalogItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateCatalogItemCommand command, CancellationToken cancellationToken)
    {
        if (id != command.ItemId)
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

        return Ok(await _sender.Send(command, cancellationToken));
    }

    [HttpPost("{id:guid}/deactivate")]
    [Authorize(Policy = Policies.CanManageClinic)]
    public async Task<IActionResult> Deactivate(Guid id, CancellationToken cancellationToken)
    {
        return Ok(await _sender.Send(new SetCatalogItemActiveCommand(id, false), cancellationToken));
    }

    [HttpPost("{id:guid}/activate")]
    [Authorize(Policy = Policies.CanManageClinic)]
    public async Task<IActionResult> Activate(Guid id, CancellationToken cancellationToken)
    {
        return Ok(await _sender.Send(new SetCatalogItemActiveCommand(id, true), cancellationToken));
    }
}

[ApiController]
[Authorize]
[Route("api/v1/treatment-plans")]
public sealed class TreatmentPlansController : ControllerBase
{
    private readonly ISender _sender;

    public TreatmentPlansController(ISender sender)
    {
        _sender = sender;
    }

    [HttpGet("{id:guid}")]
    [Authorize(Policy = Policies.CanReadPatients)]
    [ProducesResponseType(typeof(TreatmentPlanDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken cancellationToken)
    {
        return Ok(await _sender.Send(new GetTreatmentPlanQuery(id), cancellationToken));
    }

    [HttpGet("by-patient/{patientId:guid}")]
    [Authorize(Policy = Policies.CanReadPatients)]
    [ProducesResponseType(typeof(IReadOnlyList<TreatmentPlanDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetByPatient(Guid patientId, CancellationToken cancellationToken)
    {
        return Ok(await _sender.Send(new GetPatientTreatmentPlansQuery(patientId), cancellationToken));
    }

    [HttpPost]
    [Authorize(Policy = Policies.CanMutateEncounters)]
    [ProducesResponseType(typeof(TreatmentPlanDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> Create([FromBody] CreateTreatmentPlanCommand command, CancellationToken cancellationToken)
    {
        var plan = await _sender.Send(command, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = plan.Id }, plan);
    }

    [HttpPost("{id:guid}/items")]
    [Authorize(Policy = Policies.CanMutateEncounters)]
    [ProducesResponseType(typeof(TreatmentPlanDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AddItem(Guid id, [FromBody] AddPlanItemCommandBody body, CancellationToken cancellationToken)
    {
        var plan = await _sender.Send(new AddPlanItemCommand(
            id, body.CatalogItemId, body.ToothFdi, body.Surface, body.Phase, body.Quantity, body.Notes), cancellationToken);
        return Ok(plan);
    }

    [HttpDelete("{id:guid}/items/{itemId:guid}")]
    [Authorize(Policy = Policies.CanMutateEncounters)]
    [ProducesResponseType(typeof(TreatmentPlanDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> RemoveItem(Guid id, Guid itemId, CancellationToken cancellationToken)
    {
        return Ok(await _sender.Send(new RemovePlanItemCommand(id, itemId), cancellationToken));
    }

    [HttpPost("{id:guid}/submit")]
    [Authorize(Policy = Policies.CanMutateEncounters)]
    [ProducesResponseType(typeof(TreatmentPlanDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Submit(Guid id, CancellationToken cancellationToken)
    {
        return Ok(await _sender.Send(new SubmitTreatmentPlanCommand(id), cancellationToken));
    }

    [HttpPost("{id:guid}/approve")]
    [Authorize(Policy = Policies.CanMutateEncounters)]
    [ProducesResponseType(typeof(TreatmentPlanDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Approve(Guid id, CancellationToken cancellationToken)
    {
        return Ok(await _sender.Send(new ApproveTreatmentPlanCommand(id), cancellationToken));
    }

    [HttpPost("{id:guid}/cancel")]
    [Authorize(Policy = Policies.CanMutateEncounters)]
    [ProducesResponseType(typeof(TreatmentPlanDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Cancel(Guid id, CancellationToken cancellationToken)
    {
        return Ok(await _sender.Send(new CancelTreatmentPlanCommand(id), cancellationToken));
    }
}

public sealed record AddPlanItemCommandBody(
    Guid CatalogItemId,
    string? ToothFdi,
    string? Surface,
    string? Phase,
    int Quantity,
    string? Notes);
