using FluentAssertions;
using MedCanvas.Application.Common.Behaviors;
using MedCanvas.Application.Common.Interfaces;
using MediatR;
using Microsoft.Extensions.Logging;
using NSubstitute;
using Xunit;

namespace MedCanvas.Application.Tests;

public class LoggingBehaviorTests
{
    public record TestCommand : IRequest<int>;

    [Fact]
    public async Task Handle_LogsExecutionAndCallsNext()
    {
        var logger = Substitute.For<ILogger<LoggingBehavior<TestCommand, int>>>();
        var userContext = Substitute.For<ICurrentUserContext>();
        userContext.UserId.Returns(Guid.NewGuid());
        userContext.ClinicId.Returns(Guid.NewGuid());

        var behavior = new LoggingBehavior<TestCommand, int>(logger, userContext);
        var next = Substitute.For<RequestHandlerDelegate<int>>();
        next().Returns(42);

        var response = await behavior.Handle(new TestCommand(), next, CancellationToken.None);

        response.Should().Be(42);
        await next.Received(1)();
    }
}
