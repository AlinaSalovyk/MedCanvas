using FluentValidation;

namespace MedCanvas.Application.Features.Clinics;

public sealed class OnboardClinicCommandValidator : AbstractValidator<OnboardClinicCommand>
{
    private static readonly System.Text.RegularExpressions.Regex IdentifierPattern =
        new("^[A-Za-z0-9][A-Za-z0-9-]*$", System.Text.RegularExpressions.RegexOptions.Compiled);

    public OnboardClinicCommandValidator()
    {
        RuleFor(x => x.ClinicName)
            .NotEmpty().WithMessage("Clinic name is required.")
            .MaximumLength(200).WithMessage("Clinic name cannot exceed 200 characters.");

        RuleFor(x => x.ClinicIdentifier)
            .NotEmpty().WithMessage("Clinic identifier is required.")
            .Length(2, 50).WithMessage("Clinic identifier must be between 2 and 50 characters.")
            .Matches(IdentifierPattern).WithMessage("Clinic identifier may contain only letters, digits, and dashes, and must start with a letter or digit.");

        RuleFor(x => x.AdminEmail)
            .NotEmpty().WithMessage("Administrator email is required.")
            .EmailAddress().WithMessage("A valid administrator email address must be provided.")
            .MaximumLength(256).WithMessage("Administrator email cannot exceed 256 characters.");

        RuleFor(x => x.AdminFullName)
            .NotEmpty().WithMessage("Administrator full name is required.")
            .MaximumLength(200).WithMessage("Administrator full name cannot exceed 200 characters.");

        RuleFor(x => x.AdminPassword)
            .NotEmpty().WithMessage("Administrator password is required.")
            .Length(8, 100).WithMessage("Administrator password must be between 8 and 100 characters.")
            .Must(p => p != null && p.Any(char.IsLetter) && p.Any(char.IsDigit))
            .WithMessage("Administrator password must contain at least one letter and one digit.");

        RuleFor(x => x.TimeZoneId)
            .NotEmpty().WithMessage("Clinic time zone is required.")
            .Must(tz => !string.IsNullOrEmpty(tz) && TimeZoneInfo.TryFindSystemTimeZoneById(tz, out _))
            .WithMessage("Clinic time zone must be a known IANA time zone identifier.");
    }
}
