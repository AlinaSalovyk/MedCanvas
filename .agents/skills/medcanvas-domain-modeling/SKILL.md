---
name: medcanvas-domain-modeling
description: Design and implement encapsulated, invariant-enforcing domain entities, aggregates, and state machines for the MedCanvas clinical healthcare domain.
---

# MedCanvas Domain Modeling Skill

## 1. When to Activate This Skill
Activate this skill whenever:
- Creating or modifying domain entities, aggregates, or value objects in `MedCanvas.Domain`.
- Implementing clinical state transitions (e.g., draft, committed, finalized odontogram records).
- Enforcing domain invariants, data constraints, or business validations.
- Designing tooth identity, FDI notation invariants, or Status/Plan dual-state boundaries.

---

## 2. Rules Derived from Reference Architecture
From the verified reference audit (`docs/backend/reference-audit.md`):
1. **Private Constructors:**
   - Parameterless constructors must be `private` for EF Core hydration only (`private Equipment() { }`).
   - Parameterized constructors must be `private` to prevent invalid direct instantiation.
2. **Static Factory Methods:**
   - Entities are created exclusively via static factory methods (e.g. `public static OdontogramRecord New(...)`).
   - The factory method validates all input arguments before returning an instantiated instance.
3. **Private Setters:**
   - All entity properties must have `private set;`.
   - External mutation is only possible through explicit domain methods (`UpdateDetails()`, `FinalizeRecord()`, etc.).
4. **State Machine Invariants:**
   - State transitions must assert current state before allowing transition (e.g., cannot finalize an already finalized record).
   - Invariant violations throw specific exceptions (`InvalidOperationException`, `ArgumentException`, or derived `DomainException`).
5. **UTC Date Strictness:**
   - Entity timestamps (`CreatedAt`, `UpdatedAt`, `FinalizedAt`) must always be assigned `DateTime.UtcNow`.

---

## 3. MedCanvas-Specific Adaptations
1. **Core Domain Aggregates:**
   - **`Clinic` & `User`**: Clinic tenancy, clinician user profiles, clinic memberships, roles (`Clinician`, `Admin`, `Auditor`).
   - **`Patient`**: Demographics, medical alerts, clinic association, patient record number.
   - **`DentalEncounter`**: Clinical session/visit connecting a patient with an attending clinician at a specific date.
   - **`OdontogramRecord`**: The clinical dental chart aggregate root, managing snapshot revisions, dual-state status/plan payload, and finalization.
   - **`OdontogramSnapshot`**: An immutable snapshot of the tooth state graph at a specific revision.
2. **Status vs. Plan Segregation Invariant:**
   - `Status` (examination findings) and `Plan` (planned interventions) are clinically segregated. A plan intervention never mutates current status.
3. **Tooth Identity & FDI Notation (ISO 3950):**
   - Permanent teeth: `18`–`11`, `21`–`28`, `31`–`38`, `48`–`41`.
   - Deciduous (milk) teeth are charted on the permanent FDI position with substrate/selection `milktooth`.
4. **Clinical Record Finalization (Immutability):**
   - Once an `OdontogramRecord` is marked `Finalized`, further modifications are prohibited by law and domain invariants. Subsequent edits require a new revision in a new encounter.

---

## 4. Approved Patterns
- **Rich Domain Model:** Business logic lives inside the entity, not in procedural service scripts.
- **Factory Method Pattern:** `Entity.New(...)` guarantees an entity can never exist in an invalid state.
- **Explicit Domain Transition Methods:** `record.CommitDraft()`, `record.FinalizeRecord(clinicianId)`.
- **Value Objects:** Clean immutability for compound values (e.g., `PatientName`, `ToothPosition`).

---

## 5. Anti-Patterns (Forbidden)
- ❌ Public setters on domain entity properties.
- ❌ Public parameterless constructors allowing uninitialized instances.
- ❌ Anemic entities with logic spread across application services.
- ❌ Storing local times (`DateTime.Now`) instead of `DateTime.UtcNow`.
- ❌ Allowing modifications to finalized medical records.

---

## 6. Implementation Procedure
1. Create entity in `Domain/Entities/<Aggregate>.cs`.
2. Declare properties with `public T Property { get; private set; }`.
3. Create private parameterless constructor for EF Core.
4. Create private constructor taking valid state parameters.
5. Implement `public static <Entity> New(...)` validating every parameter.
6. Implement state transition methods enforcing business preconditions.
7. Throw descriptive domain exceptions on invariant failures.
8. Write comprehensive domain unit tests covering 100% of transitions.

---

## 7. Required Tests
- **Valid Construction Tests:** Assert properties, IDs, status, and `CreatedAt` match expectations.
- **Invalid Construction Tests:** Assert `ArgumentException` is thrown for empty strings, nulls, empty Guids, or future dates.
- **State Transition Success Tests:** Verify legal transitions (`Draft` ➔ `Committed` ➔ `Finalized`).
- **State Transition Failure Tests:** Verify illegal transitions throw `InvalidOperationException` (e.g., editing a `Finalized` record).

---

## 8. Definition of Done
- Entity is fully encapsulated with zero public setters.
- Domain invariants are covered by unit tests with 100% branch coverage.
- Timestamps strictly adhere to UTC.
- No EF Core, ASP.NET Core, or MediatR dependencies in Domain.

---

## 9. Related Evidence & Skills
- Evidence: [`docs/backend/reference-audit.md`](file:///e:/alina/React-Advanced-Odontogram/docs/backend/reference-audit.md) (Section 2, Items 2, 3, 4; Section 3.1).
- Sibling Skills: `medcanvas-backend-architecture`, `medcanvas-clinical-payload`, `medcanvas-backend-testing`.
