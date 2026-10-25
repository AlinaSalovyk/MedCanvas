using FluentValidation;
using MedCanvas.Domain.Enums;

namespace MedCanvas.Application.Features.Clinics;

public sealed class ChangeMemberRoleCommandValidator : AbstractValidator<ChangeMemberRoleCommand>
{
    public ChangeMemberRoleCommandValidator()
    {
        RuleFor(x => x.UserId)
            .NotEmpty().WithMessage("User identifier is required.");

        RuleFor(x => x.Role)
            .NotEmpty().WithMessage("Role is required.")
            .Must(r => Enum.TryParse<MembershipRole>(r, ignoreCase: false, out _))
            .WithMessage("Role must be one of: ClinicAdmin, Clinician, Assistant, Viewer.");
    }
}
