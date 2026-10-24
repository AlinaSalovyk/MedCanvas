using MedCanvas.Application.Common.Security;
using MedCanvas.Application.Features.Clinics;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace MedCanvas.Api.Controllers;

[ApiController]
[Route("api/v1/clinics")]
public sealed class ClinicsController : ControllerBase
{
    private readonly ISender _sender;

    public ClinicsController(ISender sender)
    {
        _sender = sender;
    }

    [HttpPost("onboarding")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    [ProducesResponseType(typeof(Application.Features.Auth.LoginResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Onboard([FromBody] OnboardClinicCommand command, CancellationToken cancellationToken)
    {
        var response = await _sender.Send(command, cancellationToken);
        return Ok(response);
    }

    [HttpGet("members")]
    [Authorize(Policy = Policies.CanManageClinic)]
    [ProducesResponseType(typeof(IReadOnlyList<ClinicMemberDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetMembers(CancellationToken cancellationToken)
    {
        var response = await _sender.Send(new GetClinicMembersQuery(), cancellationToken);
        return Ok(response);
    }

    [HttpPost("members")]
    [Authorize(Policy = Policies.CanManageClinic)]
    [ProducesResponseType(typeof(ClinicMemberDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> AddMember([FromBody] AddClinicMemberCommand command, CancellationToken cancellationToken)
    {
        var response = await _sender.Send(command, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, response);
    }

    [HttpPut("members/{userId:guid}/role")]
    [Authorize(Policy = Policies.CanManageClinic)]
    [ProducesResponseType(typeof(ClinicMemberDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> ChangeMemberRole(Guid userId, [FromBody] ChangeMemberRoleCommandBody body, CancellationToken cancellationToken)
    {
        var response = await _sender.Send(new ChangeMemberRoleCommand(userId, body.Role), cancellationToken);
        return Ok(response);
    }

    [HttpDelete("members/{userId:guid}")]
    [Authorize(Policy = Policies.CanManageClinic)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> RevokeMember(Guid userId, CancellationToken cancellationToken)
    {
        await _sender.Send(new RevokeClinicMemberCommand(userId), cancellationToken);
        return NoContent();
    }

    [HttpPost("members/{userId:guid}/activate")]
    [Authorize(Policy = Policies.CanManageClinic)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ActivateMember(Guid userId, CancellationToken cancellationToken)
    {
        await _sender.Send(new ActivateClinicMemberCommand(userId), cancellationToken);
        return NoContent();
    }

    [HttpGet("settings")]
    [Authorize(Policy = Policies.CanReadClinicProfile)]
    [ProducesResponseType(typeof(ClinicSettingsDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetSettings(CancellationToken cancellationToken)
    {
        var response = await _sender.Send(new GetClinicSettingsQuery(), cancellationToken);
        return Ok(response);
    }

    [HttpPut("settings")]
    [Authorize(Policy = Policies.CanManageClinic)]
    [ProducesResponseType(typeof(ClinicSettingsDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> UpdateSettings([FromBody] UpdateClinicSettingsCommand command, CancellationToken cancellationToken)
    {
        var response = await _sender.Send(command, cancellationToken);
        return Ok(response);
    }
}

/// <summary>Route/body split: the member id comes from the route, the role from the body.</summary>
public sealed record ChangeMemberRoleCommandBody(string Role);
