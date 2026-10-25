namespace MedCanvas.Application.Common.Interfaces;

/// <summary>
/// Detects provider-specific constraint violations (e.g. PostgreSQL exclusion
/// constraints) without leaking the data-provider types into the Application layer.
/// </summary>
public interface IDbConstraintViolations
{
    /// <summary>True when the exception represents a database exclusion-constraint
    /// violation (SQLSTATE 23P01) anywhere in the exception chain.</summary>
    bool IsExclusionViolation(Exception exception);
}
