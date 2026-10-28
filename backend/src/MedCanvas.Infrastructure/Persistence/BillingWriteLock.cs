using System.Data;
using MedCanvas.Application.Common.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace MedCanvas.Infrastructure.Persistence;

/// <summary>READ COMMITTED ensures reads after the lock see the preceding writer's
/// committed payments. The lock is shared by all API instances and held through commit.</summary>
public sealed class BillingWriteLock(MedCanvasDbContext dbContext) : IBillingWriteLock
{
    public async Task<IBillingWriteTransaction> AcquireAsync(Guid clinicId, CancellationToken cancellationToken)
    {
        var transaction = await dbContext.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken);
        try
        {
            var clinics = await dbContext.Clinics
                .FromSqlInterpolated($"SELECT * FROM \"Clinics\" WHERE \"Id\" = {clinicId} FOR UPDATE")
                .AsNoTracking()
                .ToListAsync(cancellationToken);
            if (clinics.Count != 1)
            {
                throw new UnauthorizedAccessException("An active clinic is required for billing.");
            }

            return new BillingWriteTransaction(transaction);
        }
        catch
        {
            await transaction.DisposeAsync();
            throw;
        }
    }

    private sealed class BillingWriteTransaction(IDbContextTransaction transaction) : IBillingWriteTransaction
    {
        public Task CommitAsync(CancellationToken cancellationToken) => transaction.CommitAsync(cancellationToken);
        public ValueTask DisposeAsync() => transaction.DisposeAsync();
    }
}
