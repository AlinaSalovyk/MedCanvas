using FluentAssertions;
using MedCanvas.Infrastructure.Services;
using Xunit;

namespace MedCanvas.Infrastructure.IntegrationTests;

public class PasswordHasherTests
{
    private readonly PasswordHasher _hasher = new();

    [Fact]
    public void HashPassword_ReturnsFormattedString()
    {
        var hash = _hasher.HashPassword("SuperSecret123!");

        hash.Should().StartWith("pbkdf2:100000:");
        hash.Split(':').Should().HaveCount(4);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void HashPassword_WithBlankPassword_ThrowsArgumentException(string? invalidPassword)
    {
        var act = () => _hasher.HashPassword(invalidPassword!);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void VerifyPassword_WithCorrectPassword_ReturnsTrue()
    {
        var password = "SecureClinicianPassword2026!";
        var hash = _hasher.HashPassword(password);

        var isValid = _hasher.VerifyPassword(password, hash);

        isValid.Should().BeTrue();
    }

    [Fact]
    public void VerifyPassword_WithIncorrectPassword_ReturnsFalse()
    {
        var hash = _hasher.HashPassword("CorrectPassword");

        var isValid = _hasher.VerifyPassword("WrongPassword", hash);

        isValid.Should().BeFalse();
    }

    [Theory]
    [InlineData(null, "hash")]
    [InlineData("pwd", null)]
    [InlineData("pwd", "invalid-format")]
    [InlineData("pwd", "pbkdf2:bad-iterations:salt:hash")]
    [InlineData("pwd", "pbkdf2:1000:not-base64:not-base64")]
    public void VerifyPassword_WithMalformedInput_ReturnsFalse(string? password, string? hash)
    {
        var isValid = _hasher.VerifyPassword(password!, hash!);
        isValid.Should().BeFalse();
    }
}
