namespace MedCanvas.Application.Common.Exceptions;

public class ConflictException : Exception
{
    public ConflictException(string message)
        : base(message)
    {
    }
}

public sealed class DuplicateMedicalRecordNumberException : ConflictException
{
    public DuplicateMedicalRecordNumberException()
        : base("A patient with this medical record number already exists in this clinic.")
    {
    }
}
