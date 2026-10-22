namespace MedCanvas.Application.Common.Interfaces;

/// <summary>
/// Service abstraction for cryptographically hashing and verifying user passwords.
/// </summary>
public interface IPasswordHasher
{
    string HashPassword(string password);
    bool VerifyPassword(string password, string passwordHash);
}
