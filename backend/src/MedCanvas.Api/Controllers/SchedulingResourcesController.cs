using MedCanvas.Application.Common.Security;
using MedCanvas.Application.Features.Scheduling;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MedCanvas.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/chairs")]
public sealed class ChairsController : ControllerBase
{
    private readonly ISender _sender;

    public ChairsController(ISender sender)
    {
        _sender = sender;
    }

    [HttpGet]
    [Authorize(Policy = Policies.CanReadCalendar)]
    [ProducesResponseType(typeof(IReadOnlyList<ChairDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(CancellationToken cancellationToken)
    {
        return Ok(await _sender.Send(new GetChairsQuery(), cancellationToken));
    }

    [HttpPost]
    [Authorize(Policy = Policies.CanManageClinic)]
    [ProducesResponseType(typeof(ChairDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create([FromBody] CreateChairCommand command, CancellationToken cancellationToken)
    {
        var chair = await _sender.Send(command, cancellationToken);
        return CreatedAtAction(nameof(GetAll), new { id = chair.Id }, chair);
    }

    [HttpPut("{id:guid}/name")]
    [Authorize(Policy = Policies.CanManageClinic)]
    [ProducesResponseType(typeof(ChairDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Rename(Guid id, [FromBody] RenameChairCommandBody body, CancellationToken cancellationToken)
    {
        return Ok(await _sender.Send(new RenameChairCommand(id, body.Name), cancellationToken));
    }

    [HttpPost("{id:guid}/deactivate")]
    [Authorize(Policy = Policies.CanManageClinic)]
    [ProducesResponseType(typeof(ChairDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Deactivate(Guid id, CancellationToken cancellationToken)
    {
        return Ok(await _sender.Send(new SetChairActiveCommand(id, false), cancellationToken));
    }

    [HttpPost("{id:guid}/activate")]
    [Authorize(Policy = Policies.CanManageClinic)]
    [ProducesResponseType(typeof(ChairDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Activate(Guid id, CancellationToken cancellationToken)
    {
        return Ok(await _sender.Send(new SetChairActiveCommand(id, true), cancellationToken));
    }
}

public sealed record RenameChairCommandBody(string Name);

[ApiController]
[Authorize]
[Route("api/v1/availability")]
public sealed class AvailabilityController : ControllerBase
{
    private readonly ISender _sender;

    public AvailabilityController(ISender sender)
    {
        _sender = sender;
    }

    [HttpGet("{clinicianUserId:guid}")]
    [Authorize(Policy = Policies.CanReadCalendar)]
    [ProducesResponseType(typeof(AvailabilityTemplateDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(Guid clinicianUserId, CancellationToken cancellationToken)
    {
        return Ok(await _sender.Send(new GetAvailabilityQuery(clinicianUserId), cancellationToken));
    }

    [HttpPut("{clinicianUserId:guid}")]
    [Authorize(Policy = Policies.CanManageCalendar)]
    [ProducesResponseType(typeof(AvailabilityTemplateDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Replace(
        Guid clinicianUserId,
        [FromBody] ReplaceAvailabilityCommandBody body,
        CancellationToken cancellationToken)
    {
        var command = new ReplaceAvailabilityCommand(
            clinicianUserId,
            body.Windows.Select(w => new AvailabilityWindowInput(
                w.DayOfWeek,
                w.StartTime,
                w.EndTime,
                (w.Breaks ?? []).Select(b => new AvailabilityBreakInput(b.StartTime, b.EndTime)).ToList())).ToList());
        return Ok(await _sender.Send(command, cancellationToken));
    }

    [HttpPost("{clinicianUserId:guid}/exceptions")]
    [Authorize(Policy = Policies.CanManageCalendar)]
    [ProducesResponseType(typeof(AvailabilityTemplateDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> AddException(
        Guid clinicianUserId,
        [FromBody] AvailabilityExceptionBody body,
        CancellationToken cancellationToken)
    {
        return Ok(await _sender.Send(new AddAvailabilityExceptionCommand(clinicianUserId, body.Date, body.IsWorkingDay), cancellationToken));
    }

    [HttpDelete("exceptions/{exceptionId:guid}")]
    [Authorize(Policy = Policies.CanManageCalendar)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RemoveException(Guid exceptionId, CancellationToken cancellationToken)
    {
        await _sender.Send(new RemoveAvailabilityExceptionCommand(exceptionId), cancellationToken);
        return NoContent();
    }
}

public sealed record AvailabilityWindowBody(
    int DayOfWeek,
    TimeOnly StartTime,
    TimeOnly EndTime,
    IReadOnlyList<AvailabilityBreakBody>? Breaks);

public sealed record AvailabilityBreakBody(TimeOnly StartTime, TimeOnly EndTime);

public sealed record ReplaceAvailabilityCommandBody(IReadOnlyList<AvailabilityWindowBody> Windows);

public sealed record AvailabilityExceptionBody(DateOnly Date, bool IsWorkingDay);
