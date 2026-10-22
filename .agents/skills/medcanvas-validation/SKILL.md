---
name: medcanvas-validation
description: Implement multi-boundary validation using FluentValidation, domain invariants, clinical payload schema verification, and standardized RFC 7807 ProblemDetails.
---

# MedCanvas Validation Skill

## 1. When to Activate This Skill
Activate this skill whenever:
- Adding or modifying request DTOs, commands, or clinical payloads.
- Writing FluentValidation `AbstractValidator<T>` classes.
- Validating odontogram JSON structures (teeth array, surfaces, ICDAS scores, periodontal metrics).
- Formatting HTTP error responses and ProblemDetails for client error handling.
- Designing negative tests for edge cases and input tampering.

---

## 2. Rules Derived from Reference Architecture
From the verified reference audit (`docs/backend/reference-audit.md`):
1. **Double-Boundary Validation:**
   - **Boundary 1 (HTTP DTO):** Evaluated at the HTTP boundary via `ValidationFilter` before controller action execution.
   - **Boundary 2 (Application Command):** Evaluated in the MediatR pipeline via `ValidationBehaviour` before handler execution.
2. **Explicit Rule Declarations:**
   - Use strongly-typed FluentValidation rules (`RuleFor(x => x.Prop).NotEmpty().MaximumLength(N)`).
3. **No Blind Trust in Frontend Validation:**
   - The backend is the source of clinical truth. Every client input can be forged or malformed and must be independently verified.

---

## 3. MedCanvas-Specific Adaptations
1. **RFC 7807 / RFC 9457 ProblemDetails Standardization:**
   - The reference had 3 different error shapes (custom anonymous objects, raw dictionaries, and problem details).
   - MedCanvas must standardize on 100% RFC 7807 ProblemDetails with:
     - `status`: HTTP status code (400, 404, 409, 422, etc.)
     - `title`: Short summary ("Validation Failed", "Clinical Invariant Violation")
     - `detail`: Human-readable explanation
     - `errors`: Dictionary of field names to array of failure messages
     - `instance`: URI of the request
2. **Clinical Payload Validation:**
   - Validate tooth keys conform to FDI ISO 3950: `18-11`, `21-28`, `31-38`, `48-41`.
   - Validate tooth surfaces: only `occlusal`, `mesial`, `distal`, `vestibular`, `lingual`.
   - Validate ICDAS depth grades: integer `0` through `6`.
   - Validate periodontal probing depths: integer `1` through `15` mm (or null for uncharted).
   - Validate Radix invariant: teeth with `toothSubstrate: "radix"` cannot carry a coronal restoration (`restorationType: "none"`).
3. **JSON Schema / Structure Rejection:**
   - Reject unparseable, oversized, or schema-violating JSON payloads with HTTP 400 Bad Request before attempting deserialization into domain state.

---

## 4. Approved Patterns
- **Rule Sets for Complex DTOs:** Breaking large validation logic into reusable validator components (e.g. `ToothStateDtoValidator`).
- **Custom Rule Extensions:** `RuleFor(x => x.FdiNumber).Must(BeValidFdiTooth).WithMessage("Invalid FDI tooth identifier")`.
- **Automatic Discovery:** Registering validators via `services.AddValidatorsFromAssemblyContaining<T>()`.

---

## 5. Anti-Patterns (Forbidden)
- ❌ Trusting client input without server-side validation.
- ❌ Returning generic 500 Internal Server Error for validation or domain constraint failures.
- ❌ Inconsistent JSON error structures across controllers.
- ❌ Putting database queries inside synchronous FluentValidation rules (keep validators fast and pure; query uniqueness in command handlers).

---

## 6. Implementation Procedure
1. Create request DTO validator in `Api/Validators/<DtoName>Validator.cs`.
2. Create application command validator in `Application/Validators/<CommandName>Validator.cs`.
3. If payload contains dental charts, attach `ClinicalPayloadValidator`.
4. Ensure global `ValidationFilter` catches invalid DTOs and returns `ValidationProblemDetails`.
5. Ensure global `ExceptionHandlingMiddleware` catches `ValidationException` and maps to HTTP 400 ProblemDetails.
6. Write unit tests for each validator testing both valid inputs and invalid permutations.

---

## 7. Required Tests
- **Boundary Tests:** Empty strings, whitespace, max length exceeded, null values.
- **Dental Rule Tests:** Invalid FDI numbers (e.g., tooth `99`), invalid surfaces (e.g., surface `top`), invalid ICDAS (e.g., grade `7`).
- **Incompatible State Tests:** Testing Radix remnant with Crown (must fail).
- **HTTP Filter Tests:** Asserting HTTP 400 response conforms to `ValidationProblemDetails` schema.

---

## 8. Definition of Done
- Every API endpoint accepting a body has an associated validator.
- Clinical payload validation rules cover all ISO 3950 and ICDAS constraints.
- ProblemDetails response strictly adheres to RFC 7807.
- Unit and integration tests verify negative failure paths for every property.

---

## 9. Related Evidence & Skills
- Evidence: [`docs/backend/reference-audit.md`](file:///e:/alina/React-Advanced-Odontogram/docs/backend/reference-audit.md) (Section 2, Items 7, 42-48, 78, 93-100; Section 5, Item 5).
- Sibling Skills: `medcanvas-clinical-payload`, `medcanvas-cqrs-mediatr`, `medcanvas-backend-testing`.
