using FluentValidation;

namespace MedCanvas.Application.Features.Clinics;

public sealed class RevokeClinicMemberCommandValidator : AbstractValidator<RevokeClinicMemberCommand>
{
    public RevokeClinicMemberCommandValidator()
    {
        RuleFor(x => x.UserId)
            .NotEmpty().WithMessage("User identifier is required.");
    }
}
