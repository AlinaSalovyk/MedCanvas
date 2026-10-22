using MedCanvas.Domain.Exceptions;

namespace MedCanvas.Domain.ValueObjects;

/// <summary>
/// Immutable value object representing a valid permanent FDI (ISO 3950) tooth coordinate.
/// </summary>
public sealed class FdiToothNumber : IEquatable<FdiToothNumber>
{
    private static readonly HashSet<int> ValidPermanentNumbers =
    [
        18, 17, 16, 15, 14, 13, 12, 11,
        21, 22, 23, 24, 25, 26, 27, 28,
        31, 32, 33, 34, 35, 36, 37, 38,
        48, 47, 46, 45, 44, 43, 42, 41
    ];

    public int Number { get; }
    public string Key => Number.ToString();
    public int Quadrant => Number / 10;
    public int Position => Number % 10;
    public bool IsUpper => Quadrant is 1 or 2;
    public bool IsLower => Quadrant is 3 or 4;
    public bool IsMolar => Position is 6 or 7 or 8;
    public bool IsPremolar => Position is 4 or 5;
    public bool IsAnterior => Position is 1 or 2 or 3;

    private FdiToothNumber(int number)
    {
        Number = number;
    }

    public static FdiToothNumber From(int number)
    {
        if (!ValidPermanentNumbers.Contains(number))
        {
            throw new InvalidFdiCoordinateException(number.ToString());
        }

        return new FdiToothNumber(number);
    }

    public static FdiToothNumber From(string key)
    {
        if (string.IsNullOrWhiteSpace(key) || !int.TryParse(key.Trim(), out var number))
        {
            throw new InvalidFdiCoordinateException(key ?? string.Empty);
        }

        return From(number);
    }

    public static bool TryParse(string key, out FdiToothNumber? toothNumber)
    {
        if (!string.IsNullOrWhiteSpace(key) && int.TryParse(key.Trim(), out var number) && ValidPermanentNumbers.Contains(number))
        {
            toothNumber = new FdiToothNumber(number);
            return true;
        }

        toothNumber = null;
        return false;
    }

    public static IReadOnlyCollection<int> AllPermanentNumbers => ValidPermanentNumbers;

    public override string ToString() => Key;

    public bool Equals(FdiToothNumber? other)
    {
        if (other is null) return false;
        if (ReferenceEquals(this, other)) return true;
        return Number == other.Number;
    }

    public override bool Equals(object? obj) => Equals(obj as FdiToothNumber);

    public override int GetHashCode() => Number.GetHashCode();

    public static bool operator ==(FdiToothNumber? left, FdiToothNumber? right) => Equals(left, right);
    public static bool operator !=(FdiToothNumber? left, FdiToothNumber? right) => !Equals(left, right);
}
