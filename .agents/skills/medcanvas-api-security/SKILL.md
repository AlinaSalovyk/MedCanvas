---
name: medcanvas-api-security
description: Apply security, authentication, role-based authorization, multi-tenant clinic isolation, and audit logging standards across all MedCanvas API endpoints and services.
---

# MedCanvas API Security Skill

## 1. When to Activate
Activate this skill whenever:
- Designing, implementing, or modifying any HTTP endpoint in `MedCanvas.Api`.
- Implementing authentication (JWT bearer authentication, token claims validation).
- Implementing authorization policies, role requirements, or clinical ownership checks.
- Handling protected health information (PHI) and clinical audit logs.
- Configuring CORS, request rate limiting, payload size thresholds, and security middleware.
- Writing security integration tests (401 Unauthorized, 403 Forbidden, IDOR, data leakage).

---

## 2. Reference Audit Learning & Anti-Patterns to Avoid

In the reference backend audit (`docs/backend/reference-audit.md`), critical security weaknesses were discovered that **MUST NEVER** be reproduced in MedCanvas:

1. **Permissive Insecure CORS**:
   - *Reference anti-pattern*: `builder.Services.AddCors(options => options.AddPolicy("AllowAll", p => p.SetIsOriginAllowed(_ => true).AllowAnyMethod().AllowAnyHeader().AllowCredentials()));`
   - *Risk*: Allows arbitrary origins to perform credentialed requests against the backend.
   - *MedCanvas Standard*: Explicit allowed origins configured in `appsettings.json` (or environment variables). Never combine `AllowCredentials()` with wildcard or open origin predicates.

2. **Missing Controller Authorization**:
   - *Reference anti-pattern*: All reference controllers lacked `[Authorize]` attributes completely, leaving endpoints accessible anonymously.
   - *MedCanvas Standard*: Enforce `[Authorize]` at the controller or fallback policy level. Explicitly opt out only for public health check or login endpoints via `[AllowAnonymous]`.

3. **Hardcoded Secrets**:
   - *Reference anti-pattern*: Database passwords, JWT secret keys, and connection strings committed in plaintext in `appsettings.json`.
   - *MedCanvas Standard*: Development configurations use local placeholders; production uses environment variables (`MEDCANVAS__JWT__KEY`, etc.) or Azure Key Vault / Secret Manager. Never commit real keys.

4. **Zero Auditing of Sensitive Operations**:
   - *Reference anti-pattern*: Data modifications occurred without recording who made the change or why.
   - *MedCanvas Standard*: Full medical audit trail (`ClinicalAuditEvent`) persisted for all clinical reads/writes with actor ID, timestamp, and patient identifier.

---

## 3. Core Architectural Rules

### 3.1 Authentication & Claims
- All protected endpoints require a valid JWT Bearer token issued by an authorized Identity Provider or MedCanvas Token Service.
- Validated claims:
  - `sub` (or `ClaimTypes.NameIdentifier`): Unique User ID (GUID).
  - `clinic_id`: Clinic ID to which the active session belongs.
  - `role`: Roles such as `Clinician`, `ClinicAdmin`, `Assistant`.
  - `email`: Clinician email.

### 3.2 Multi-Tenant Clinic Isolation (Anti-IDOR)
- **Principle**: A user authorized in Clinic A must NEVER be able to read, update, or delete patients, encounters, or odontograms belonging to Clinic B, even if they guess the GUID.
- **Enforcement**:
  - Every clinical query/command MUST validate that the target resource belongs to the caller's active `ClinicId`.
  - Repositories or Query Services MUST filter by `ClinicId` (e.g. `_context.Patients.Where(p => p.ClinicId == currentClinicId && p.Id == patientId)`).
  - If a resource exists in another clinic, the API returns `404 Not Found` (to prevent enumeration) or `403 Forbidden`.

### 3.3 Protected Health Information (PHI) Logging Protection
- Standard application logs (Console, Serilog) MUST NEVER log raw patient names, identifiers, national health numbers, or raw odontogram payloads.
- Log only non-sensitive operational identifiers: `EncounterId`, `UserId`, `ClinicId`, and hashed or masked `PatientId`.
- Sensitive fields in exception messages must be sanitized before logging or returning to clients.

### 3.4 Medical Audit Trail
- Every clinical record creation, update, finalization, or access event MUST trigger a `ClinicalAuditEvent`.
- Attributes: `Id`, `ClinicId`, `PatientId`, `EncounterId`, `ActorUserId`, `Action` (e.g., `OdontogramCreated`, `OdontogramUpdated`, `OdontogramFinalized`), `TimestampUtc`, `ClientIpAddress`, and `DetailsHash`.
- Clinical audit events are append-only; updates and deletions are strictly forbidden by database triggers and domain constraints.

### 3.5 Consistent RFC 7807 ProblemDetails
- Return structured ProblemDetails for all error responses:
  - 400 Bad Request (Validation failure).
  - 401 Unauthorized (Missing or invalid token).
  - 403 Forbidden (Insufficient permissions or cross-clinic access attempt).
  - 404 Not Found (Resource does not exist or belongs to another tenant).
  - 409 Conflict (Optimistic concurrency conflict).
  - 412 Precondition Failed (ETag mismatch).
  - 500 Internal Server Error (Unhandled server error, details masked in production).

---

## 4. Implementation Checklist

- [ ] Controller has `[Authorize]` attribute (or uses authorized route group).
- [ ] Handler extracts `ICurrentUserContext` or receives validated `ClinicId` / `UserId`.
- [ ] Query/Command verifies ownership of the aggregate root against caller's `ClinicId`.
- [ ] Sensitive clinical actions create a `ClinicalAuditEvent`.
- [ ] CORS policy specifies exact origins without wildcard credentials.
- [ ] Request body size limit enforced for odontogram JSON payloads (e.g., max 10MB).
- [ ] No PHI printed to standard stdout/stderr logs.
- [ ] Automated security tests verify 401, 403, and cross-clinic rejection.
