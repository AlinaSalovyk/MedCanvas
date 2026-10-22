namespace MedCanvas.Domain.Exceptions;

/// <summary>
/// Thrown when an optimistic concurrency check fails because the client-supplied version token does not match the server state.
/// </summary>
public sealed class ConcurrencyConflictException : DomainException
{
    public Guid AggregateId { get; }
    public int ExpectedVersion { get; }
    public int ActualVersion { get; }

    public ConcurrencyConflictException(Guid aggregateId, int expectedVersion, int actualVersion)
        : base($"Concurrency conflict on aggregate '{aggregateId}'. Expected version {expectedVersion}, but actual database version is {actualVersion}.")
    {
        AggregateId = aggregateId;
        ExpectedVersion = expectedVersion;
        ActualVersion = actualVersion;
    }
}
