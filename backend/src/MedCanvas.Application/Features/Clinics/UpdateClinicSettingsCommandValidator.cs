using FluentValidation;

namespace MedCanvas.Application.Features.Clinics;

public sealed class UpdateClinicSettingsCommandValidator : AbstractValidator<UpdateClinicSettingsCommand>
{
    public UpdateClinicSettingsCommandValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Clinic name is required.")
            .MaximumLength(200).WithMessage("Clinic name cannot exceed 200 characters.");

        RuleFor(x => x.TimeZoneId)
            .NotEmpty().WithMessage("Clinic time zone is required.")
            .Must(tz => TimeZoneInfo.TryFindSystemTimeZoneById(tz, out _))
            .WithMessage("Clinic time zone must be a known IANA time zone identifier.");
    }
}
