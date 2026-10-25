using FluentValidation;

namespace MedCanvas.Application.Features.Clinics;

public sealed class ActivateClinicMemberCommandValidator : AbstractValidator<ActivateClinicMemberCommand>
{
    public ActivateClinicMemberCommandValidator()
    {
        RuleFor(x => x.UserId)
            .NotEmpty().WithMessage("User identifier is required.");
    }
}
