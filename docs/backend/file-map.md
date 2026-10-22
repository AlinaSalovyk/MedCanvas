# MedCanvas Backend Verified File Map

Complete file map of all first-party backend projects, layers, and test suites in `backend/`.

## 1. Solution & Configuration
| File | Responsibility |
|---|---|
| `backend/MedCanvas.sln` | Central .NET solution containing all 10 projects. |
| `backend/Directory.Build.props` | Common MSBuild properties (.NET 10, nullable enable, strict warnings). |
| `backend/README.md` | Quick onboarding and architectural overview. |

---

## 2. MedCanvas.Domain (`backend/src/MedCanvas.Domain/`)
| File | Responsibility |
|---|---|
| `Common/BaseEntity.cs` | Base entity with strongly-typed `Id` (Guid), audit timestamps (`CreatedAtUtc`, `UpdatedAtUtc`), and domain events collection. |
| `Common/IDomainEvent.cs` | Marker interface for MediatR domain events. |
| `Entities/Clinic.cs` | Aggregate root for dental clinics with active status, code, and naming. |
| `Entities/User.cs` | Aggregate root for clinical users with password hash and profile data. |
| `Entities/ClinicMembership.cs` | Association between users and clinics with role assignment (`Admin`, `Clinician`, `Assistant`, `Viewer`). |
| `Entities/Patient.cs` | Patient aggregate root with medical record number, demographics, contact info, and medical alerts. |
| `Entities/DentalEncounter.cs` | Dental encounter aggregate root managing status transitions (`InProgress`, `Completed`, `Cancelled`) and attending clinician. |
| `Entities/OdontogramRecord.cs` | Central clinical record holding the canonical `jsonb` snapshot, optimistic `ConcurrencyVersion`, and finalization immutability. |
| `Entities/OdontogramRevision.cs` | Append-only historical revisions capturing prior states and author metadata. |
| `Entities/ClinicalAuditEvent.cs` | Tamper-evident audit log for HIPAA compliance capturing actor, action, and resource. |
| `ValueObjects/FdiToothNumber.cs` | Invariant-enforcing FDI ISO 3950 tooth number validator (permanent 11-48, primary 51-85). |
| `Enums/MembershipRole.cs` | Clinic authorization roles (`Admin`, `Clinician`, `Assistant`, `Viewer`). |
| `Enums/EncounterStatus.cs` | Clinical encounter states (`InProgress`, `Completed`, `Cancelled`). |
| `Exceptions/DomainException.cs` | Base domain exception representing clinical invariant violations. |
| `Exceptions/FinalizedRecordException.cs` | Thrown when an edit is attempted on an immutable finalized record. |
| `Exceptions/InvalidClinicalPayloadException.cs` | Thrown when an invalid odontogram payload is supplied. |

---

## 3. MedCanvas.Application (`backend/src/MedCanvas.Application/`)
| File | Responsibility |
|---|---|
| `DependencyInjection.cs` | MediatR pipeline and FluentValidation auto-registration. |
| `Common/Interfaces/IMedCanvasDbContext.cs` | Database context interface abstracting EF Core entities for Clean Architecture boundaries. |
| `Common/Interfaces/ICurrentUserContext.cs` | Context providing the active authenticated user, clinic, and role. |
| `Common/Interfaces/IJwtTokenService.cs` | Abstraction for generating HMAC-SHA256 JWT tokens. |
| `Common/Interfaces/IPasswordHasher.cs` | Abstraction for PBKDF2/BCrypt password hashing. |
| `Common/Interfaces/IFhirBundleBuilder.cs` | Abstraction for building HL7 FHIR R4 Bundle documents. |
| `Common/Behaviors/LoggingBehavior.cs` | MediatR pipeline behavior logging CQRS execution timing with PHI redaction. |
| `Common/Behaviors/ValidationBehavior.cs` | MediatR pipeline behavior executing FluentValidation and throwing `ValidationException`. |
| `Common/Exceptions/NotFoundException.cs` | Thrown when requested clinical resource does not exist. |
| `Common/Exceptions/ConcurrencyConflictException.cs` | Thrown when optimistic concurrency token does not match. |
| `Common/Exceptions/ForbiddenAccessException.cs` | Thrown on cross-tenant clinic access attempt. |
| `Features/Auth/LoginCommand.cs` & `LoginCommandHandler.cs` | Clinician login returning JWT token. |
| `Features/Auth/LoginCommandValidator.cs` | Validates email, password, and clinic identifier. |
| `Features/Auth/GetCurrentUserQuery.cs` & Handler | Returns current authenticated user and clinic profile. |
| `Features/Patients/CreatePatientCommand.cs` & Handler | Registers a new patient within the active clinic. |
| `Features/Patients/CreatePatientCommandValidator.cs` | Validates patient demographic fields and email format. |
| `Features/Patients/UpdatePatientCommand.cs` & Handler | Updates patient demographic details. |
| `Features/Patients/GetPatientByIdQuery.cs` & Handler | Retrieves single patient by ID with clinic scoping. |
| `Features/Patients/GetPatientsQuery.cs` & Handler | Paginated search of clinic patients. |
| `Features/Encounters/StartEncounterCommand.cs` & Handler | Begins a new dental encounter. |
| `Features/Encounters/StartEncounterCommandValidator.cs` | Validates encounter start fields. |
| `Features/Encounters/CompleteEncounterCommand.cs` & Handler | Finalizes an encounter. |
| `Features/Encounters/CancelEncounterCommand.cs` & Handler | Cancels an encounter. |
| `Features/Encounters/GetEncounterByIdQuery.cs` & Handler | Retrieves encounter details. |
| `Features/Encounters/GetPatientEncountersQuery.cs` & Handler | Retrieves encounter history for a patient. |
| `Features/Encounters/GetEncounterFhirBundleQuery.cs` & Handler | Translates encounter odontogram to HL7 FHIR R4 Bundle. |
| `Features/Odontograms/SaveOdontogramCommand.cs` & Handler | Saves canonical `jsonb` snapshot with ETag verification and revision tracking. |
| `Features/Odontograms/SaveOdontogramCommandValidator.cs` | Validates snapshot JSON schema and properties. |
| `Features/Odontograms/FinalizeOdontogramCommand.cs` & Handler | Finalizes odontogram record, making it immutable. |
| `Features/Odontograms/GetOdontogramByEncounterQuery.cs` & Handler | Retrieves odontogram snapshot for an encounter. |
| `Features/Odontograms/GetLatestOdontogramByPatientQuery.cs` & Handler | Retrieves patient's latest clinical odontogram. |
| `Features/Odontograms/GetOdontogramRevisionsQuery.cs` & Handler | Retrieves historical revision trail for audit review. |

---

## 4. MedCanvas.Infrastructure (`backend/src/MedCanvas.Infrastructure/`)
| File | Responsibility |
|---|---|
| `DependencyInjection.cs` | Infrastructure DI registration (PostgreSQL DbContext, services). |
| `Persistence/MedCanvasDbContext.cs` | Core EF Core DbContext mapping all entities and `jsonb` snapshots. |
| `Persistence/Configurations/*.cs` | 8 dedicated entity type configurations enforcing table names, keys, FKs, unique indexes, and PostgreSQL `jsonb` column types. |
| `Persistence/Migrations/*.cs` | EF Core migrations (`InitialCreate`). |
| `Services/JwtTokenService.cs` | HMAC-SHA256 JWT generation with role and clinic claims. |
| `Services/PasswordHasher.cs` | PBKDF2 secure password hashing and verification. |
| `Services/FhirBundleBuilder.cs` | Translates canonical odontogram JSON into compliant HL7 FHIR R4 Bundle. |

---

## 5. MedCanvas.Api (`backend/src/MedCanvas.Api/`)
| File | Responsibility |
|---|---|
| `Program.cs` | Web host bootstrap, middleware pipeline, JWT auth, CORS, Swagger, and ProblemDetails. |
| `Middleware/ExceptionHandlingMiddleware.cs` | Maps exceptions to RFC 7807 ProblemDetails (400, 401, 403, 404, 412, 422, 500). |
| `Services/CurrentUserContext.cs` | Extracts user ID, clinic ID, and role from `HttpContext.User`. |
| `Controllers/AuthController.cs` | Authentication endpoints (`/api/v1/auth/login`, `/api/v1/auth/me`). |
| `Controllers/PatientsController.cs` | Patient endpoints (`/api/v1/patients`). |
| `Controllers/DentalEncountersController.cs` | Encounter endpoints (`/api/v1/encounters`). |
| `Controllers/OdontogramsController.cs` | Odontogram endpoints with `If-Match`/`ETag` headers and FHIR export. |

---

## 6. Test Projects (`backend/tests/`)
| Project | Test Count | Responsibility |
|---|---|---|
| `MedCanvas.Domain.Tests` | 108 tests | Unit testing entity invariants, state machines, value objects, and domain exceptions (95.46% coverage). |
| `MedCanvas.Application.Tests` | 35 tests | Unit testing MediatR pipeline behaviors and FluentValidation rules. |
| `MedCanvas.Infrastructure.IntegrationTests` | 17 tests | Integration testing EF Core configurations, unique constraints, FKs, and `jsonb` columns against PostgreSQL 16 Testcontainers. |
| `MedCanvas.Api.IntegrationTests` | 26 tests | End-to-end HTTP integration testing all API controllers, authentication, multi-tenant IDOR protection, optimistic concurrency, and FHIR export against PostgreSQL 16 Testcontainers. |
| **TOTAL** | **186 tests** | **100% automated passing test suite.** |
