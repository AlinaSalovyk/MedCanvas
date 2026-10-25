using MedCanvas.Application.Common.Interfaces;
using Npgsql;

namespace MedCanvas.Infrastructure.Services;

public sealed class DbConstraintViolations : IDbConstraintViolations
{
    public bool IsExclusionViolation(Exception exception)
    {
        for (var current = exception; current != null; current = current.InnerException)
        {
            if (current is PostgresException { SqlState: "23P01" })
            {
                return true;
            }
        }

        return false;
    }
}
