using FluentAssertions;
using FluentValidation;
using FluentValidation.Results;
using MedCanvas.Application.Common.Behaviors;
using MediatR;
using NSubstitute;
using Xunit;

namespace MedCanvas.Application.Tests;

public class ValidationBehaviorTests
{
    public record SampleCommand(string Name, int Age) : IRequest<string>;

    [Fact]
    public async Task Handle_WithNoValidators_CallsNextDelegate()
    {
        var behavior = new ValidationBehavior<SampleCommand, string>([]);
        var next = Substitute.For<RequestHandlerDelegate<string>>();
        next().Returns("Success");

        var response = await behavior.Handle(new SampleCommand("John", 30), next, CancellationToken.None);

        response.Should().Be("Success");
        await next.Received(1)();
    }

    [Fact]
    public async Task Handle_WithValidRequest_CallsNextDelegate()
    {
        var validator = Substitute.For<IValidator<SampleCommand>>();
        validator.ValidateAsync(Arg.Any<ValidationContext<SampleCommand>>(), Arg.Any<CancellationToken>())
            .Returns(new ValidationResult());

        var behavior = new ValidationBehavior<SampleCommand, string>([validator]);
        var next = Substitute.For<RequestHandlerDelegate<string>>();
        next().Returns("Success");

        var response = await behavior.Handle(new SampleCommand("John", 30), next, CancellationToken.None);

        response.Should().Be("Success");
        await next.Received(1)();
    }

    [Fact]
    public async Task Handle_WithValidationFailures_ThrowsValidationException()
    {
        var failures = new List<ValidationFailure>
        {
            new("Name", "Name is required"),
            new("Age", "Age must be positive")
        };

        var validator = Substitute.For<IValidator<SampleCommand>>();
        validator.ValidateAsync(Arg.Any<ValidationContext<SampleCommand>>(), Arg.Any<CancellationToken>())
            .Returns(new ValidationResult(failures));

        var behavior = new ValidationBehavior<SampleCommand, string>([validator]);
        var next = Substitute.For<RequestHandlerDelegate<string>>();

        var act = async () => await behavior.Handle(new SampleCommand("", -5), next, CancellationToken.None);

        var ex = await act.Should().ThrowAsync<ValidationException>();
        ex.Which.Errors.Should().HaveCount(2);
        await next.DidNotReceive()();
    }
}
