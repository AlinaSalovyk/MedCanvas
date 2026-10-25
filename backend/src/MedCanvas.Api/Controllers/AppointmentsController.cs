using MedCanvas.Api.Common;
using MedCanvas.Application.Common.Security;
using MedCanvas.Application.Features.Scheduling;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MedCanvas.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/appointments")]
public sealed class AppointmentsController : ControllerBase
{
    private readonly ISender _sender;

    public AppointmentsController(ISender sender)
    {
        _sender = sender;
    }

    [HttpGet]
    [Authorize(Policy = Policies.CanReadCalendar)]
    [ProducesResponseType(typeof(IReadOnlyList<AppointmentDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetWindow(
        [FromQuery] DateTime fromUtc,
        [FromQuery] DateTime toUtc,
        [FromQuery] Guid? clinicianId = null,
        [FromQuery] Guid? chairId = null,
        [FromQuery] Domain.Enums.AppointmentStatus? status = null,
        CancellationToken cancellationToken = default)
    {
        var result = await _sender.Send(
            new GetAppointmentsQuery(SpecifyUtc(fromUtc), SpecifyUtc(toUtc), clinicianId, chairId, status),
            cancellationToken);
        return Ok(result);
    }

    [HttpPost]
    [Authorize(Policy = Policies.CanManageCalendar)]
    [ProducesResponseType(typeof(AppointmentDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create([FromBody] CreateAppointmentCommand command, CancellationToken cancellationToken)
    {
        command = command with { StartAtUtc = SpecifyUtc(command.StartAtUtc), EndAtUtc = SpecifyUtc(command.EndAtUtc) };
        var result = await _sender.Send(command, cancellationToken);
        Response.Headers.ETag = $"\"{result.ConcurrencyVersion}\"";
        return CreatedAtAction(nameof(GetWindow), new { fromUtc = result.StartAtUtc, toUtc = result.EndAtUtc }, result);
    }

    [HttpPost("{id:guid}/confirm")]
    [Authorize(Policy = Policies.CanManageCalendar)]
    [ProducesResponseType(typeof(AppointmentDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Confirm(Guid id, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new ConfirmAppointmentCommand(id), cancellationToken);
        Response.Headers.ETag = $"\"{result.ConcurrencyVersion}\"";
        return Ok(result);
    }

    [HttpPost("{id:guid}/arrive")]
    [Authorize(Policy = Policies.CanManageCalendar)]
    [ProducesResponseType(typeof(AppointmentDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Arrive(Guid id, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new MarkAppointmentArrivedCommand(id), cancellationToken);
        Response.Headers.ETag = $"\"{result.ConcurrencyVersion}\"";
        return Ok(result);
    }

    [HttpPost("{id:guid}/complete")]
    [Authorize(Policy = Policies.CanManageCalendar)]
    [ProducesResponseType(typeof(AppointmentDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Complete(Guid id, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new CompleteAppointmentCommand(id), cancellationToken);
        Response.Headers.ETag = $"\"{result.ConcurrencyVersion}\"";
        return Ok(result);
    }

    [HttpPost("{id:guid}/no-show")]
    [Authorize(Policy = Policies.CanManageCalendar)]
    [ProducesResponseType(typeof(AppointmentDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> NoShow(Guid id, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new MarkAppointmentNoShowCommand(id), cancellationToken);
        Response.Headers.ETag = $"\"{result.ConcurrencyVersion}\"";
        return Ok(result);
    }

    [HttpPost("{id:guid}/cancel")]
    [Authorize(Policy = Policies.CanManageCalendar)]
    [ProducesResponseType(typeof(AppointmentDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Cancel(Guid id, [FromBody] CancelAppointmentCommandBody body, CancellationToken cancellationToken)
    {
        var result = await _sender.Send(new CancelAppointmentCommand(id, body.Reason), cancellationToken);
        Response.Headers.ETag = $"\"{result.ConcurrencyVersion}\"";
        return Ok(result);
    }

    [HttpPost("{id:guid}/reschedule")]
    [Authorize(Policy = Policies.CanManageCalendar)]
    [ProducesResponseType(typeof(AppointmentDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status412PreconditionFailed)]
    [ProducesResponseType(StatusCodes.Status428PreconditionRequired)]
    public async Task<IActionResult> Reschedule(
        Guid id,
        [FromBody] RescheduleAppointmentRequest body,
        CancellationToken cancellationToken)
    {
        var (isValid, expectedVersion, problem) = IfMatchPreconditionParser.ParseIfMatchHeader(
            Request.Headers,
            HttpContext.Request.Path,
            body.ExpectedVersion);

        if (!isValid)
        {
            return BadRequest(problem);
        }

        var command = new RescheduleAppointmentCommand(
            id,
            SpecifyUtc(body.NewStartAtUtc),
            SpecifyUtc(body.NewEndAtUtc),
            body.NewChairId,
            expectedVersion);

        var result = await _sender.Send(command, cancellationToken);
        Response.Headers.ETag = $"\"{result.ConcurrencyVersion}\"";
        return Ok(result);
    }

    internal static DateTime SpecifyUtc(DateTime value) =>
        value.Kind == DateTimeKind.Utc ? value : DateTime.SpecifyKind(value, DateTimeKind.Utc);
}

public sealed record CancelAppointmentCommandBody(string Reason);

public sealed record RescheduleAppointmentRequest(
    DateTime NewStartAtUtc,
    DateTime NewEndAtUtc,
    Guid? NewChairId = null,
    int? ExpectedVersion = null);
