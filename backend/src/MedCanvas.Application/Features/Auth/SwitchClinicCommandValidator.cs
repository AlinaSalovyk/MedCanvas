using FluentValidation;

namespace MedCanvas.Application.Features.Auth;

public sealed class SwitchClinicCommandValidator : AbstractValidator<SwitchClinicCommand>
{
    public SwitchClinicCommandValidator()
    {
        RuleFor(x => x.ClinicId)
            .NotEmpty().WithMessage("Target clinic identifier is required.");
    }
}
