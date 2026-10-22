# MedCanvas Backend Implementation Plan (Vertical Slices Roadmap)

> **Document Status:** Authoritative Implementation Roadmap  
> **Engineering Methodology:** Test-Driven Vertical Slices / Clean Architecture  
> **Commit Policy:** Atomic commits per modified or added file ("одна зміна у файлі — один коміт")

---

## 1. Overview & Engineering Principles

The MedCanvas backend is constructed in 10 sequential, test-verified vertical slices. Each slice traverses the full Clean Architecture stack (Domain -> Application -> Infrastructure -> Api -> Tests), ensuring that features are immediately verifiable and backed by unit and real PostgreSQL integration tests before proceeding to the next.

---

## 2. Vertical Slice Roadmap

### Slice 1: Solution Foundation & Dependency Graph
- **Goal**: Scaffold `.NET 10 LTS` solution with four clean architecture projects and six test projects.
- **Projects**:
  - `src/MedCanvas.Domain`
  - `src/MedCanvas.Application`
  - `src/MedCanvas.Infrastructure`
  - `src/MedCanvas.Api`
  - `tests/MedCanvas.Domain.Tests`
  - `tests/MedCanvas.Application.Tests`
  - `tests/MedCanvas.Infrastructure.IntegrationTests`
  - `tests/MedCanvas.Api.IntegrationTests`
  - `tests/MedCanvas.Tests.Common`
  - `tests/MedCanvas.Tests.Data`
- **Output**: Compiling solution `backend/MedCanvas.sln` with verified layer dependencies.

---

### Slice 2: Domain Model & Clinical Invariants
- **Goal**: Implement rich encapsulated entities and value objects.
- **Components**:
  - `Clinic`, `User`, `ClinicMembership`
  - `Patient`
  - `DentalEncounter` (Encounter status machine)
  - `OdontogramRecord` (Status/Plan JSONB aggregate, concurrency versioning, finalization seal)
  - `OdontogramRevision` (Immutable historical snapshot)
  - `ClinicalAuditEvent` (Append-only audit trail)
  - Domain exceptions: `RecordFinalizedException`, `ConcurrencyConflictException`, `InvalidFdiCoordinateException`
- **Tests**: Exhaustive domain unit tests (construction, valid/invalid transitions, immutability).

---

### Slice 3: PostgreSQL Persistence Foundation & EF Core Mappings
- **Goal**: EF Core context with PostgreSQL provider, JSONB column mapping, and explicit foreign key constraints.
- **Components**:
  - `MedCanvasDbContext`
  - Entity Configurations: `ClinicConfiguration`, `UserConfiguration`, `PatientConfiguration`, `EncounterConfiguration`, `OdontogramRecordConfiguration`, `OdontogramRevisionConfiguration`, `ClinicalAuditEventConfiguration`
  - JSONB value conversion / EF Core PostgreSQL jsonb mapping
  - Initial database migration: `InitialCreate`
- **Tests**: Real PostgreSQL Testcontainers migration test, foreign key cascade/restrict tests.

---

### Slice 4: Application Pipeline, Security Services & ProblemDetails
- **Goal**: MediatR CQRS pipeline behaviors and centralized HTTP error handling.
- **Components**:
  - `ValidationBehavior<TRequest, TResponse>`
  - `LoggingBehavior<TRequest, TResponse>` (PHI-safe)
  - `ExceptionHandlingMiddleware` (RFC 7807 ProblemDetails mapping)
  - `ICurrentUserContext` & `CurrentUserContext` implementation
  - `IPasswordHasher` & `IJwtTokenService`
- **Tests**: Pipeline behavior unit tests, ProblemDetails exception mapping tests.

---

### Slice 5: Authentication & Clinic Scoping Slice
- **Goal**: Clinician login, token issuance, and clinic membership resolution.
- **Components**:
  - Commands: `LoginCommand`, `RefreshTokenCommand`
  - Queries: `GetCurrentUserQuery`
  - Controllers: `AuthController`
- **Tests**: Auth unit tests, JWT token generation tests, `401 Unauthorized` API integration tests.

---

### Slice 6: Patient Management Slice
- **Goal**: Multi-tenant patient registration, search, and demographics update.
- **Components**:
  - Commands: `CreatePatientCommand`, `UpdatePatientCommand`
  - Queries: `GetPatientsQuery` (paginated), `GetPatientByIdQuery`
  - Validators: `CreatePatientCommandValidator`
  - Controllers: `PatientsController`
- **Tests**: Validator tests, IDOR tenant isolation tests (preventing Clinic B from accessing Clinic A's patients).

---

### Slice 7: Dental Encounter Lifecycle Slice
- **Goal**: Clinical session creation, status progression, and notes.
- **Components**:
  - Commands: `StartEncounterCommand`, `UpdateEncounterStatusCommand`
  - Queries: `GetPatientEncountersQuery`, `GetEncounterByIdQuery`
  - Controllers: `DentalEncountersController`
- **Tests**: Encounter lifecycle state machine tests, practitioner assignment tests.

---

### Slice 8: Canonical Odontogram & Optimistic Concurrency Slice
- **Goal**: 100% lossless canonical odontogram persistence, optimistic locking with ETag, finalization seals, and revision history.
- **Components**:
  - Commands: `SaveOdontogramCommand`, `FinalizeOdontogramCommand`
  - Queries: `GetOdontogramByEncounterQuery`, `GetLatestOdontogramByPatientQuery`, `GetOdontogramRevisionsQuery`, `GetOdontogramRevisionSnapshotQuery`
  - Validators: `SaveOdontogramCommandValidator` (validates versions, 32 FDI keys, caries severity, perio ranges)
  - Controllers: `OdontogramsController`
- **Tests**:
  - Optimistic concurrency tests (`412 Precondition Failed` / `409 Conflict`).
  - Finalization seal test (edits rejected on finalized charts).
  - Revision history test.
  - Round-trip fidelity test matching synthetic frontend fixtures.

---

### Slice 9: FHIR R4 Adapter Export Slice
- **Goal**: On-demand translation of canonical JSON snapshot into HL7® FHIR® R4 Bundle.
- **Components**:
  - Queries: `GetOdontogramFhirBundleQuery`
  - Controllers: `FhirController` or `/odontogram/fhir`
- **Tests**: FHIR bundle structural validation, Condition/Observation/ServiceRequest assertions.

---

### Slice 10: Exhaustive Automated Test Verification & Quality Gates
- **Goal**: Execute full test suites across all layers.
- **Execution**:
  - `dotnet test backend/MedCanvas.sln --configuration Release --collect:"XPlat Code Coverage"`
  - Verify line coverage targets: Domain & Application >= 95%, overall >= 85%.
  - Zero skipped or failing tests.

---

### Slice 11: CI Pipeline & Final Documentation
- **Goal**: GitHub Actions CI workflow and technical onboarding artifacts.
- **Components**:
  - `.github/workflows/backend-ci.yml`
  - Final documentation and verification report.
