using FluentValidation;

namespace MedCanvas.Application.Features.Patients;

public sealed class CreatePatientCommandValidator : AbstractValidator<CreatePatientCommand>
{
    public CreatePatientCommandValidator()
    {
        RuleFor(x => x.FirstName)
            .NotEmpty().WithMessage("First name is required.")
            .MaximumLength(100).WithMessage("First name cannot exceed 100 characters.");

        RuleFor(x => x.LastName)
            .NotEmpty().WithMessage("Last name is required.")
            .MaximumLength(100).WithMessage("Last name cannot exceed 100 characters.");

        RuleFor(x => x.Email)
            .EmailAddress().WithMessage("A valid email address must be provided.")
            .MaximumLength(256).WithMessage("Email cannot exceed 256 characters.")
            .When(x => !string.IsNullOrWhiteSpace(x.Email));

        RuleFor(x => x.Phone)
            .MaximumLength(50).WithMessage("Phone cannot exceed 50 characters.")
            .When(x => !string.IsNullOrWhiteSpace(x.Phone));

        RuleFor(x => x.ExternalMedicalRecordNumber)
            .MaximumLength(50).WithMessage("MRN cannot exceed 50 characters.")
            .When(x => !string.IsNullOrWhiteSpace(x.ExternalMedicalRecordNumber));

        RuleFor(x => x.Gender)
            .MaximumLength(20).WithMessage("Gender cannot exceed 20 characters.")
            .When(x => !string.IsNullOrWhiteSpace(x.Gender));
    }
}
