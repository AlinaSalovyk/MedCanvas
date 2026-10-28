using MedCanvas.Application.Common.Security;
using MedCanvas.Application.Features.Billing;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MedCanvas.Api.Controllers;

/// <summary>
/// Internal demo billing. Every payment in this controller is a SIMULATED
/// demonstration record (IsDemo=true, INV-008) — no real money movement exists.
/// </summary>
[ApiController]
[Authorize]
[Route("api/v1/invoices")]
public sealed class BillingController : ControllerBase
{
    private readonly ISender _sender;

    public BillingController(ISender sender)
    {
        _sender = sender;
    }

    [HttpGet("{id:guid}")]
    [Authorize(Policy = Policies.CanReadPatients)]
    [ProducesResponseType(typeof(InvoiceDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken cancellationToken)
    {
        return Ok(await _sender.Send(new GetInvoiceQuery(id), cancellationToken));
    }

    [HttpGet("by-patient/{patientId:guid}")]
    [Authorize(Policy = Policies.CanReadPatients)]
    [ProducesResponseType(typeof(IReadOnlyList<InvoiceDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetByPatient(Guid patientId, CancellationToken cancellationToken)
    {
        return Ok(await _sender.Send(new GetPatientInvoicesQuery(patientId), cancellationToken));
    }

    [HttpPost("from-encounter/{encounterId:guid}")]
    [Authorize(Policy = Policies.CanMutateEncounters)]
    [ProducesResponseType(typeof(InvoiceDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CreateFromEncounter(Guid encounterId, CancellationToken cancellationToken)
    {
        var invoice = await _sender.Send(new CreateInvoiceFromEncounterCommand(encounterId), cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = invoice.Id }, invoice);
    }

    [HttpPost("{id:guid}/simulated-payments")]
    [Authorize(Policy = Policies.CanRegisterSimulatedPayments)]
    [ProducesResponseType(typeof(InvoiceDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RegisterSimulatedPayment(Guid id, [FromBody] RegisterSimulatedPaymentBody body, CancellationToken cancellationToken)
    {
        return Ok(await _sender.Send(new RegisterSimulatedPaymentCommand(
            id, body.Amount, body.MethodLabel, body.IdempotencyKey), cancellationToken));
    }

    [HttpPost("{id:guid}/void")]
    [Authorize(Policy = Policies.CanMutateEncounters)]
    [ProducesResponseType(typeof(InvoiceDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Void(Guid id, [FromBody] VoidInvoiceBody body, CancellationToken cancellationToken)
    {
        return Ok(await _sender.Send(new VoidInvoiceCommand(id, body.Reason), cancellationToken));
    }
}

public sealed record RegisterSimulatedPaymentBody(decimal Amount, string MethodLabel, string IdempotencyKey);

public sealed record VoidInvoiceBody(string Reason);
