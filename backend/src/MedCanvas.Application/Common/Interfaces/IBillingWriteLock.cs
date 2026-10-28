namespace MedCanvas.Application.Common.Interfaces;

/// <summary>Database transaction serializing billing writes for one clinic, including
/// the clinic-wide idempotency-key namespace. Dispose without commit rolls back.</summary>
public interface IBillingWriteLock
{
    Task<IBillingWriteTransaction> AcquireAsync(Guid clinicId, CancellationToken cancellationToken);
}

public interface IBillingWriteTransaction : IAsyncDisposable
{
    Task CommitAsync(CancellationToken cancellationToken);
}
