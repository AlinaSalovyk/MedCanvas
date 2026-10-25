using FluentValidation;

namespace MedCanvas.Application.Features.Scheduling;

public sealed class CreateAppointmentCommandValidator : AbstractValidator<CreateAppointmentCommand>
{
    public CreateAppointmentCommandValidator()
    {
        RuleFor(x => x.PatientId)
            .NotEmpty().WithMessage("Patient identifier is required.");

        RuleFor(x => x.ClinicianUserId)
            .NotEmpty().WithMessage("Clinician identifier is required.");

        RuleFor(x => x.ChairId)
            .NotEmpty().WithMessage("Chair identifier is required.");

        RuleFor(x => x.StartAtUtc)
            .NotEmpty().WithMessage("Start time is required.")
            .Must(BeUtc).WithMessage("Start time must be specified in UTC.");

        RuleFor(x => x.EndAtUtc)
            .NotEmpty().WithMessage("End time is required.")
            .Must(BeUtc).WithMessage("End time must be specified in UTC.")
            .GreaterThan(x => x.StartAtUtc).WithMessage("End time must be after start time.")
            .Must((cmd, end) => end - cmd.StartAtUtc <= TimeSpan.FromHours(8))
            .WithMessage("Appointment duration cannot exceed 8 hours.");

        RuleFor(x => x.ReasonForVisit)
            .NotEmpty().WithMessage("Reason for visit is required.")
            .MaximumLength(500).WithMessage("Reason for visit cannot exceed 500 characters.");

        RuleFor(x => x.InternalNote)
            .MaximumLength(1000).WithMessage("Internal note cannot exceed 1000 characters.")
            .When(x => !string.IsNullOrWhiteSpace(x.InternalNote));
    }

    private static bool BeUtc(DateTime value) => value.Kind == DateTimeKind.Utc;
}
