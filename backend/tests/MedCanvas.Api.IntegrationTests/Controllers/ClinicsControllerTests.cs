using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using MedCanvas.Api.IntegrationTests.Infrastructure;
using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Application.Features.Auth;
using MedCanvas.Application.Features.Clinics;
using MedCanvas.Domain.Entities;
using MedCanvas.Domain.Enums;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace MedCanvas.Api.IntegrationTests.Controllers;

public class ClinicsControllerTests : IClassFixture<MedCanvasApiFactory>, IAsyncLifetime
{
    private readonly MedCanvasApiFactory _factory;
    private readonly HttpClient _client;

    public ClinicsControllerTests(MedCanvasApiFactory factory)
    {
        _factory = factory;
        _client = factory.CreateAnonymousClient();
    }

    public async Task InitializeAsync()
    {
        await _factory.ResetDatabaseAsync();
    }

    public Task DisposeAsync() => Task.CompletedTask;

    private async Task<(Clinic Clinic, User Admin, HttpClient Client)> SeedClinicWithAdminAsync(
        string identifier,
        string adminEmail = "admin@example.com")
    {
        var now = DateTime.UtcNow;
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();

        var clinic = Clinic.Create($"Clinic {identifier}", identifier, now);
        var admin = User.Create(adminEmail, "Clinic Admin", hasher.HashPassword("StrongP@ssw0rd123!"), now);
        db.Clinics.Add(clinic);
        db.Users.Add(admin);
        db.ClinicMemberships.Add(ClinicMembership.Create(clinic.Id, admin.Id, MembershipRole.ClinicAdmin, now));
        await db.SaveChangesAsync();

        return (clinic, admin, _factory.CreateAuthenticatedClient(admin, clinic.Id, MembershipRole.ClinicAdmin));
    }

    private async Task<User> SeedMemberAsync(Guid clinicId, string email, MembershipRole role)
    {
        var now = DateTime.UtcNow;
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();
        var user = User.Create(email, $"Member {email}", hasher.HashPassword("StrongP@ssw0rd123!"), now);
        db.Users.Add(user);
        db.ClinicMemberships.Add(ClinicMembership.Create(clinicId, user.Id, role, now));
        await db.SaveChangesAsync();
        return user;
    }

    // ---------------------------------------------------------------- onboarding

    [Fact]
    public async Task Onboard_WithValidPayload_CreatesClinicAdminAndReturnsAuthenticatedToken()
    {
        var response = await _client.PostAsJsonAsync("/api/v1/clinics/onboarding", new
        {
            clinicName = "Sunrise Dental",
            clinicIdentifier = "SUNRISE-01",
            adminEmail = "founder@sunrise.com",
            adminFullName = "Founder",
            adminPassword = "StrongP@ssw0rd123!",
            timeZoneId = "Europe/Kyiv"
        });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<LoginResultDto>();
        result!.RequiresClinicSelection.Should().BeFalse();
        result.Token.Should().NotBeNullOrWhiteSpace();
        result.Role.Should().Be("ClinicAdmin");
        result.ClinicName.Should().Be("Sunrise Dental");

        // The token must grant access to the new tenant
        var newClient = _factory.CreateClient();
        newClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", result.Token);
        var me = await newClient.GetAsync("/api/v1/auth/me");
        me.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Onboard_WithAlreadyRegisteredEmail_Returns409()
    {
        await SeedClinicWithAdminAsync("ONBOARD-A");

        var response = await _client.PostAsJsonAsync("/api/v1/clinics/onboarding", new
        {
            clinicName = "Clone Clinic",
            clinicIdentifier = "CLONE-01",
            adminEmail = "admin@example.com",
            adminFullName = "Attacker",
            adminPassword = "StrongP@ssw0rd123!"
        });

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Onboard_WithDuplicateClinicIdentifier_Returns409()
    {
        await SeedClinicWithAdminAsync("DUP-ID");

        var response = await _client.PostAsJsonAsync("/api/v1/clinics/onboarding", new
        {
            clinicName = "Other Clinic",
            clinicIdentifier = "DUP-ID",
            adminEmail = "other@example.com",
            adminFullName = "Other",
            adminPassword = "StrongP@ssw0rd123!"
        });

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Onboard_WithWeakPassword_Returns400ValidationProblem()
    {
        var response = await _client.PostAsJsonAsync("/api/v1/clinics/onboarding", new
        {
            clinicName = "Weak Clinic",
            clinicIdentifier = "WEAK-01",
            adminEmail = "weak@example.com",
            adminFullName = "Weak",
            adminPassword = "short"
        });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        response.Content.Headers.ContentType!.MediaType.Should().Be("application/problem+json");
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("validation-failed");
    }

    // ---------------------------------------------------------------- members listing

    [Fact]
    public async Task GetMembers_AsClinicAdmin_ReturnsAllMembershipsIncludingRevoked()
    {
        var (clinic, admin, adminClient) = await SeedClinicWithAdminAsync("MEMBERS-1");
        var clinician = await SeedMemberAsync(clinic.Id, "doc@example.com", MembershipRole.Clinician);
        var revoked = await SeedMemberAsync(clinic.Id, "former@example.com", MembershipRole.Assistant);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IMedCanvasDbContext>();
            var membership = db.ClinicMemberships.First(m => m.UserId == revoked.Id);
            membership.Deactivate(DateTime.UtcNow);
            await db.SaveChangesAsync();
        }

        var response = await adminClient.GetAsync("/api/v1/clinics/members");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var members = await response.Content.ReadFromJsonAsync<List<ClinicMemberDto>>();
        members!.Should().HaveCount(3);
        members.Single(m => m.UserId == revoked.Id).MembershipActive.Should().BeFalse();
        members.Single(m => m.UserId == clinician.Id).Role.Should().Be("Clinician");
        members.Should().Contain(m => m.UserId == admin.Id && m.Role == "ClinicAdmin");
    }

    [Fact]
    public async Task GetMembers_AsClinician_Returns403()
    {
        var (clinic, _, _) = await SeedClinicWithAdminAsync("MEMBERS-2");
        var clinician = await SeedMemberAsync(clinic.Id, "doc2@example.com", MembershipRole.Clinician);
        var clinicianClient = _factory.CreateAuthenticatedClient(clinician, clinic.Id, MembershipRole.Clinician);

        var response = await clinicianClient.GetAsync("/api/v1/clinics/members");

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task GetMembers_Unauthenticated_Returns401()
    {
        var response = await _client.GetAsync("/api/v1/clinics/members");
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ---------------------------------------------------------------- add member

    [Fact]
    public async Task AddMember_AsClinicAdmin_CreatesStaffAccountWithRole()
    {
        var (clinic, _, adminClient) = await SeedClinicWithAdminAsync("ADD-1");

        var response = await adminClient.PostAsJsonAsync("/api/v1/clinics/members", new
        {
            email = "new.assistant@example.com",
            fullName = "New Assistant",
            password = "StrongP@ssw0rd123!",
            role = "Assistant"
        });

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var member = await response.Content.ReadFromJsonAsync<ClinicMemberDto>();
        member!.Role.Should().Be("Assistant");
        member.MembershipActive.Should().BeTrue();

        // The new member can log in and access the clinic
        var login = await _client.PostAsJsonAsync("/api/v1/auth/login",
            new LoginCommand("new.assistant@example.com", "StrongP@ssw0rd123!", clinic.Id));
        login.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task AddMember_WithExistingEmail_Returns409()
    {
        var (clinic, _, adminClient) = await SeedClinicWithAdminAsync("ADD-2", "taken@example.com");

        var response = await adminClient.PostAsJsonAsync("/api/v1/clinics/members", new
        {
            email = "taken@example.com",
            fullName = "Duplicate",
            password = "StrongP@ssw0rd123!",
            role = "Viewer"
        });

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task AddMember_AsAssistant_Returns403()
    {
        var (clinic, _, _) = await SeedClinicWithAdminAsync("ADD-3");
        var assistant = await SeedMemberAsync(clinic.Id, "helper@example.com", MembershipRole.Assistant);
        var assistantClient = _factory.CreateAuthenticatedClient(assistant, clinic.Id, MembershipRole.Assistant);

        var response = await assistantClient.PostAsJsonAsync("/api/v1/clinics/members", new
        {
            email = "someone@example.com",
            fullName = "Someone",
            password = "StrongP@ssw0rd123!",
            role = "Viewer"
        });

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task AddMember_WithInvalidRole_Returns400()
    {
        var (_, _, adminClient) = await SeedClinicWithAdminAsync("ADD-4");

        var response = await adminClient.PostAsJsonAsync("/api/v1/clinics/members", new
        {
            email = "x@example.com",
            fullName = "X",
            password = "StrongP@ssw0rd123!",
            role = "SuperAdmin"
        });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // ---------------------------------------------------------------- role change

    [Fact]
    public async Task ChangeMemberRole_AsAdmin_PromotesClinicianToAdmin()
    {
        var (clinic, _, adminClient) = await SeedClinicWithAdminAsync("ROLE-1");
        var clinician = await SeedMemberAsync(clinic.Id, "promote@example.com", MembershipRole.Clinician);

        var response = await adminClient.PutAsJsonAsync($"/api/v1/clinics/members/{clinician.Id}/role", new { role = "ClinicAdmin" });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var member = await response.Content.ReadFromJsonAsync<ClinicMemberDto>();
        member!.Role.Should().Be("ClinicAdmin");
    }

    [Fact]
    public async Task ChangeMemberRole_OnSelf_Returns409()
    {
        var (clinic, admin, adminClient) = await SeedClinicWithAdminAsync("ROLE-2");

        var response = await adminClient.PutAsJsonAsync($"/api/v1/clinics/members/{admin.Id}/role", new { role = "Clinician" });

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task ChangeMemberRole_OnForeignClinicMember_Returns404()
    {
        var (clinicA, _, adminClientA) = await SeedClinicWithAdminAsync("ROLE-A");
        var (clinicB, _, _) = await SeedClinicWithAdminAsync("ROLE-B", "admin-b@example.com");
        var memberB = await SeedMemberAsync(clinicB.Id, "member-b@example.com", MembershipRole.Clinician);

        var response = await adminClientA.PutAsJsonAsync($"/api/v1/clinics/members/{memberB.Id}/role", new { role = "Assistant" });

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // Note: the last-active-admin guard in MembershipGuards is defense-in-depth — with the
    // current CanManageClinic policy any authorized actor is themselves an active ClinicAdmin,
    // so the guard is not reachable through the API without the self-change/self-revoke guards
    // firing first. The reachable lockout protections are the self-guards tested above/below.

    // ---------------------------------------------------------------- revoke / activate

    [Fact]
    public async Task RevokeMember_AsAdmin_DeactivatesMembershipImmediately()
    {
        var (clinic, _, adminClient) = await SeedClinicWithAdminAsync("REVOKE-1");
        var clinician = await SeedMemberAsync(clinic.Id, "revoke-me@example.com", MembershipRole.Clinician);
        var clinicianClient = _factory.CreateAuthenticatedClient(clinician, clinic.Id, MembershipRole.Clinician);

        var response = await adminClient.DeleteAsync($"/api/v1/clinics/members/{clinician.Id}");

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Revocation is instant even for previously issued tokens
        var after = await clinicianClient.GetAsync("/api/v1/clinics/members");
        after.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task RevokeMember_OnSelf_Returns409()
    {
        var (clinic, admin, adminClient) = await SeedClinicWithAdminAsync("REVOKE-2");

        var response = await adminClient.DeleteAsync($"/api/v1/clinics/members/{admin.Id}");

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task RevokeMember_OnLastRemainingAdmin_IsBlockedBySelfGuard()
    {
        var (clinic, admin, adminClient) = await SeedClinicWithAdminAsync("REVOKE-3");
        // Seed a second admin, revoke them (allowed — one admin remains), then confirm the
        // last remaining admin cannot lock the clinic out: self-revoke is rejected.
        var secondAdmin = await SeedMemberAsync(clinic.Id, "admin2@example.com", MembershipRole.ClinicAdmin);

        var revokeSecond = await adminClient.DeleteAsync($"/api/v1/clinics/members/{secondAdmin.Id}");
        revokeSecond.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var selfAttempt = await adminClient.DeleteAsync($"/api/v1/clinics/members/{admin.Id}");
        selfAttempt.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task RevokeMember_OnForeignClinicMember_Returns404()
    {
        var (clinicA, _, adminClientA) = await SeedClinicWithAdminAsync("REVOKE-A");
        var (clinicB, _, _) = await SeedClinicWithAdminAsync("REVOKE-B", "admin-rb@example.com");
        var memberB = await SeedMemberAsync(clinicB.Id, "member-rb@example.com", MembershipRole.Clinician);

        var response = await adminClientA.DeleteAsync($"/api/v1/clinics/members/{memberB.Id}");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task ActivateMember_RestoresAccess()
    {
        var (clinic, _, adminClient) = await SeedClinicWithAdminAsync("ACT-1");
        var clinician = await SeedMemberAsync(clinic.Id, "restore@example.com", MembershipRole.Clinician);
        await adminClient.DeleteAsync($"/api/v1/clinics/members/{clinician.Id}");

        var response = await adminClient.PostAsync($"/api/v1/clinics/members/{clinician.Id}/activate", content: null);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var clinicianClient = _factory.CreateAuthenticatedClient(clinician, clinic.Id, MembershipRole.Clinician);
        var settings = await clinicianClient.GetAsync("/api/v1/clinics/settings");
        settings.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    // ---------------------------------------------------------------- settings

    [Fact]
    public async Task GetSettings_AsAnyMember_ReturnsClinicProfile()
    {
        var (clinic, _, _) = await SeedClinicWithAdminAsync("SET-1");
        var viewer = await SeedMemberAsync(clinic.Id, "viewer@example.com", MembershipRole.Viewer);
        var viewerClient = _factory.CreateAuthenticatedClient(viewer, clinic.Id, MembershipRole.Viewer);

        var response = await viewerClient.GetAsync("/api/v1/clinics/settings");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var settings = await response.Content.ReadFromJsonAsync<ClinicSettingsDto>();
        settings!.TimeZoneId.Should().Be("Europe/Kyiv");
        settings.Identifier.Should().Be("SET-1");
    }

    [Fact]
    public async Task UpdateSettings_AsAdmin_RenamesClinicAndChangesTimeZone()
    {
        var (clinic, _, adminClient) = await SeedClinicWithAdminAsync("SET-2");

        var response = await adminClient.PutAsJsonAsync("/api/v1/clinics/settings", new
        {
            name = "Renamed Clinic",
            timeZoneId = "Europe/London"
        });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var settings = await response.Content.ReadFromJsonAsync<ClinicSettingsDto>();
        settings!.Name.Should().Be("Renamed Clinic");
        settings.TimeZoneId.Should().Be("Europe/London");
        settings.Identifier.Should().Be("SET-2");
    }

    [Fact]
    public async Task UpdateSettings_AsClinician_Returns403()
    {
        var (clinic, _, _) = await SeedClinicWithAdminAsync("SET-3");
        var clinician = await SeedMemberAsync(clinic.Id, "doc@example.com", MembershipRole.Clinician);
        var clinicianClient = _factory.CreateAuthenticatedClient(clinician, clinic.Id, MembershipRole.Clinician);

        var response = await clinicianClient.PutAsJsonAsync("/api/v1/clinics/settings", new
        {
            name = "Hacked Clinic",
            timeZoneId = "Europe/Kyiv"
        });

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task UpdateSettings_WithUnknownTimeZone_Returns400()
    {
        var (_, _, adminClient) = await SeedClinicWithAdminAsync("SET-4");

        var response = await adminClient.PutAsJsonAsync("/api/v1/clinics/settings", new
        {
            name = "Ok Name",
            timeZoneId = "Mars/Olympus"
        });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }
}
