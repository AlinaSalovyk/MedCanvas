using FluentValidation;
using MedCanvas.Domain.Enums;

namespace MedCanvas.Application.Features.Clinics;

public sealed class AddClinicMemberCommandValidator : AbstractValidator<AddClinicMemberCommand>
{
    public AddClinicMemberCommandValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("Staff email is required.")
            .EmailAddress().WithMessage("A valid staff email address must be provided.")
            .MaximumLength(256).WithMessage("Staff email cannot exceed 256 characters.");

        RuleFor(x => x.FullName)
            .NotEmpty().WithMessage("Staff full name is required.")
            .MaximumLength(200).WithMessage("Staff full name cannot exceed 200 characters.");

        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("Staff password is required.")
            .Length(8, 100).WithMessage("Staff password must be between 8 and 100 characters.")
            .Must(p => p.Any(char.IsLetter) && p.Any(char.IsDigit))
            .WithMessage("Staff password must contain at least one letter and one digit.");

        RuleFor(x => x.Role)
            .NotEmpty().WithMessage("Role is required.")
            .Must(r => Enum.TryParse<MembershipRole>(r, ignoreCase: false, out _))
            .WithMessage("Role must be one of: ClinicAdmin, Clinician, Assistant, Viewer.");
    }
}
