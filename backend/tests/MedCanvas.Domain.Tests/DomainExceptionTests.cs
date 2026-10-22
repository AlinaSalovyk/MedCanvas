using FluentAssertions;
using MedCanvas.Domain.Exceptions;
using Xunit;

namespace MedCanvas.Domain.Tests;

public class DomainExceptionTests
{
    private class TestDomainException : DomainException
    {
        public TestDomainException(string message) : base(message) { }
        public TestDomainException(string message, Exception inner) : base(message, inner) { }
    }

    [Fact]
    public void Constructor_WithMessage_SetsMessage()
    {
        var ex = new TestDomainException("Test error");
        ex.Message.Should().Be("Test error");
    }

    [Fact]
    public void Constructor_WithMessageAndInner_SetsProperties()
    {
        var inner = new InvalidOperationException("Inner error");
        var ex = new TestDomainException("Test error", inner);

        ex.Message.Should().Be("Test error");
        ex.InnerException.Should().Be(inner);
    }
}
