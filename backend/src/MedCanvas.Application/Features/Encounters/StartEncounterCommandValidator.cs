using FluentValidation;

namespace MedCanvas.Application.Features.Encounters;

public sealed class StartEncounterCommandValidator : AbstractValidator<StartEncounterCommand>
{
    public StartEncounterCommandValidator()
    {
        RuleFor(x => x.PatientId)
            .NotEmpty().WithMessage("Patient identifier is required.");

        RuleFor(x => x.ChiefComplaint)
            .MaximumLength(1000).WithMessage("Chief complaint cannot exceed 1000 characters.")
            .When(x => !string.IsNullOrWhiteSpace(x.ChiefComplaint));
    }
}
