---
name: medcanvas-backend-testing
description: Enforce comprehensive automated test standards for all MedCanvas backend code: Unit, Domain, CQRS Handler, Validator, Repository, PostgreSQL Testcontainers Integration, and Security tests.
---

# MedCanvas Backend Testing Skill (MANDATORY RELEASE GATE)

## 1. When to Activate
Activate this skill whenever:
- Designing, implementing, modifying, or refactoring ANY backend class, entity, handler, validator, controller, or configuration.
- Before committing any backend slice to ensure strict quality gate compliance.
- Running unit, integration, concurrency, or contract test suites.
- Measuring test coverage and identifying untested edge cases.

**CORE RULE: Never mark an implementation complete just because it builds. Code without automated tests is considered non-functional.**

---

## 2. Test Pyramid & Responsibilities

| Test Tier | Project Location | Scope & Dependencies | Execution Target |
|---|---|---|---|
| **Domain Unit Tests** | `tests/MedCanvas.Domain.Tests/` | Pure C# unit tests. Zero external dependencies. Verifies entities, value objects, domain invariants, exceptions. | Fast (< 1 sec) |
| **Application Unit Tests** | `tests/MedCanvas.Application.Tests/` | Tests MediatR Command/Query handlers, FluentValidation rules, pipeline behaviors with lightweight mocks (NSubstitute/Moq). | Fast (< 3 sec) |
| **PostgreSQL Integration Tests** | `tests/MedCanvas.Infrastructure.IntegrationTests/` | Tests real EF Core context, repositories, queries, migrations, JSONB columns using real PostgreSQL via Testcontainers. | Real Docker Container |
| **API Integration Tests** | `tests/MedCanvas.Api.IntegrationTests/` | End-to-end HTTP pipeline tests via `WebApplicationFactory<Program>`, authenticating requests, testing controllers, status codes, ProblemDetails, and security policies. | Real Docker Container |
| **Clinical Payload Contract Tests** | `tests/MedCanvas.Api.IntegrationTests/Contracts/` | Round-trip tests matching frontend native JSON fixtures with backend serialization. | Real Docker Container |

---

## 3. Test Fixture & Testcontainers Standards

### 3.1 Pinned Docker Image
- In reference backend audit (`docs/backend/reference-audit.md`), the floating tag `postgres:latest` was identified as an unpredictable anti-pattern.
- In MedCanvas, **ALWAYS pin the exact engine**: `postgres:16-alpine`.
- Never use in-memory EF Core database provider for integration testing; PostgreSQL-specific features (such as `jsonb` indexing, UUID generation, and concurrency tokens) require real PostgreSQL.

### 3.2 Shared Fixture Pattern (`IAsyncLifetime`)
```csharp
public class PostgreSqlFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _container = new PostgreSqlBuilder()
        .WithImage("postgres:16-alpine")
        .WithDatabase("medcanvas_test")
        .WithUsername("postgres")
        .WithPassword("postgres")
        .Build();

    public string ConnectionString => _container.GetConnectionString();

    public async Task InitializeAsync()
    {
        await _container.StartAsync();
    }

    public async Task DisposeAsync()
    {
        await _container.DisposeAsync();
    }
}
```

### 3.3 Test Database Isolation
- Every integration test class or collection must run against a migrated database schema.
- Use Respawn or transaction rollback between test cases to ensure zero test pollution.

---

## 4. Required Test Categories per Feature Slice

For every implemented vertical slice (e.g. Patients, Encounters, Odontograms):

### 4.1 Domain Tests
- [ ] Valid construction with all required parameters.
- [ ] Argument exceptions thrown for null/empty/invalid invariants.
- [ ] Valid state transitions succeed and update `UpdatedAtUtc`.
- [ ] Illegal state transitions throw specific domain exceptions (e.g., editing a finalized record).
- [ ] Entity equality and aggregate boundaries respected.

### 4.2 FluentValidation Tests
- [ ] Valid DTO/Command passes validation.
- [ ] Missing required fields produce expected property-level errors.
- [ ] Boundary conditions (string length, date ranges, number limits) tested.
- [ ] Invalid tooth keys or malformed payload versions fail validation.

### 4.3 CQRS Handler Tests
- [ ] Successful execution persists data and returns expected response.
- [ ] Missing entity throws `NotFoundException` (mapping to 404).
- [ ] Business rule violation throws `DomainException` (mapping to 400 or 422).
- [ ] Concurrency conflict throws `ConcurrencyException` (mapping to 409 or 412).
- [ ] `CancellationToken` cancellation is propagated and respected.

### 4.4 Web API HTTP Pipeline Tests
- [ ] `200 OK` or `201 Created` with accurate body and `ETag` / `Location` headers.
- [ ] `400 Bad Request` with structured `ProblemDetails` for validation failures.
- [ ] `401 Unauthorized` when JWT is missing or invalid.
- [ ] `403 Forbidden` when attempting to access a resource from another Clinic (IDOR test).
- [ ] `404 Not Found` for nonexistent resources.
- [ ] `409 Conflict` / `412 Precondition Failed` on optimistic concurrency version mismatch.

### 4.5 Clinical JSON Round-Trip Fixtures
- [ ] Load synthetic frontend fixtures:
  - Default empty chart (32 teeth sound).
  - Multi-surface caries and composite restorations.
  - Status vs. Plan independent differences.
  - Six-site periodontal probing depths and bleeding points.
- [ ] Save to backend API -> read back from backend API -> assert deep structural equality.

---

## 5. Coverage Gates & Quality Metrics

1. **Line Coverage Targets**:
   - `MedCanvas.Domain`: **>= 95%**
   - `MedCanvas.Application`: **>= 95%**
   - `MedCanvas.Infrastructure` & `MedCanvas.Api`: **>= 85%**
2. **Endpoint Coverage**: 100% of exposed HTTP endpoints must have at least one positive integration test and negative validation/auth tests.
3. **Execution Command**:
   ```powershell
   dotnet test backend/MedCanvas.sln --configuration Release --collect:"XPlat Code Coverage"
   ```
4. **Zero Skipped or Ignored Tests**: Never commit commented-out or skipped tests without explicit documented justification.

---

## 6. Persistent Verification & Quality Invariants

All future agents modifying or adding backend code MUST adhere strictly to the following rules:

1. **Every New Feature Requires Tests**: No feature is complete without accompanying Domain, Application, and API integration tests.
2. **Every Bug Fix Requires Regression Coverage**: Every defect resolved must have a dedicated test reproducing the initial defect and proving the fix (RED -> GREEN).
3. **Actual HTTP Contract Tests**: Validate real HTTP requests through `WebApplicationFactory` for all routes, query parameters, optional bodies (`EmptyBodyBehavior.Allow`), status codes, ProblemDetails, and headers.
4. **Real PostgreSQL Concurrency Tests**: Concurrency tokens, optimistic locking, strong ETag preconditions (`If-Match: "<version>"`), missing preconditions (`428 Precondition Required`), and stale version conflicts (`412 Precondition Failed`) must be tested against real PostgreSQL Testcontainers.
5. **Privacy-Safe Logging Tests**: Use synthetic PHI sentinels (e.g. MRN, patient names, passwords) to verify that raw identifiers are NEVER reflected in response bodies, application logs, or ExceptionHandlingMiddleware logs.
6. **Frontend-Generated Clinical Fixtures**: Use actual frontend `serializeState()` / `defaultState()` output in versioned JSON fixture files (`backend/tests/MedCanvas.Tests.Data/Fixtures/generated/`) with automated drift checks (`npm run fixtures:generate`).
7. **Failure-Path Autosave Tests**: Every clinical sync bridge must be tested for failure paths: prove that a failed save or conflict blocks encounter switching, retains dirty state, avoids silent overwrites, and uses generation tokens to isolate late asynchronous responses.
8. **Clinical Invariants Require Multi-Layer Tests**: Clinical rules (FDI tooth ranges 11-48 & 51-85, caries surfaces, restoration constraints, dual-state separation, radix-restoration row gating) must be tested at both Domain and Validator/Integration layers.
9. **Authorization Must Be Tested with Real HTTP Calls**: Do not rely on mocked authorization handlers or unit test assertions alone. Test real HTTP requests through `WebApplicationFactory` with authorized, unauthorized, revoked, expired, and wrong-clinic identities (anti-IDOR).
10. **Persistence Must Be Tested Against PostgreSQL**: Never use EF Core InMemory provider to validate schema or queries. Test all migrations, concurrency tokens, unique indexes, and JSONB queries against real PostgreSQL via Testcontainers (`postgres:16-alpine`).
11. **Frontend/Backend Contracts Must Remain Synchronized**: Any route, query parameter, DTO shape, ETag precondition, or payload version change must be reflected in both backend controllers and `src/api/client.ts`.
12. **CI Must Pass Before Approval**: Never approve a pull request or merge when automated GitHub Actions CI is red, queued, or failing.
13. **Tests Cannot Be Deleted or Weakened to Hide Bugs**: Removing tests or relaxing assertions to mask underlying bugs or schema mismatches is strictly forbidden.
14. **Actual Test Results Must Be Reported**: Always report actual test execution numbers directly from the test runner output, not estimated or assumed counts. Future agents must read this skill before touching backend code.
