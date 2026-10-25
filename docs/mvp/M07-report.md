# MEDCANVAS — MODULE M07 IMPLEMENTATION & QUALITY REPORT

**Module:** M07 — Invoices & Simulated Payments
**Branch:** `feat/mvp-demo-billing` · **Base:** `fbbfdce` (M06 merge).

## 1. Implemented requirements (TZ §M07)

| Requirement | Implementation |
|---|---|
| **FR-601/602 Invoice from procedures** | `POST /invoices/from-encounter/{id}` — server sums non-voided `Recorded` procedures of the encounter; empty ⇒ 409; unique invoice number; **already-billed procedures are never invoiced twice** (voided invoices excluded from the guard, re-issuing after void is allowed). |
| **INV-008 Simulation integrity** | `IsDemo` constant true on the aggregate, `IsSimulation=true` on every payment; UI section header carries a permanent **«ДЕМО / СИМУЛЬОВАНА ОПЛАТА»** badge; no banking integration, no card data, no fiscalization anywhere. |
| **FR-603/604 Partial payments** | Multiple `SimulatedPayment`s per invoice; statuses `Issued → PartiallySimulated → FullySimulated` server-computed. |
| **FR-606 Overpay forbidden** | Domain `AddSimulatedPayment` rejects amount > remaining (400, tested). |
| **FR-607 Idempotency & history** | Per-clinic unique payment `IdempotencyKey` (DB index) — retried request returns the original record without duplication (tested); payments are individual records; voids are compensating with reason. |
| **Void** | `VoidInvoice` with reason ⇒ `Voided` (tested); audited. |
| **Roles** | Invoice issue/void: Admin/Clinician (`CanMutateEncounters`); simulated payment registration: Admin/Assistant/Clinician (`CanMutatePatients` per TZ §3.2 "Створення рахунків: Так / Опціонально за політикою / Так"). |

## 2. Test evidence (actual runs)
| Suite | Result |
|---|---|
| Backend full | **476/476** (+8 integration: server total 1000.75 from two procedures, empty 409, partial→full transitions with balance math, overpay 400, idempotent retry single record, void, isolation 404, negative amount 400) |
| tsc / build / format | PASS / PASS / PASS |
| Vitest / Playwright / lint | recorded at PR (green locally) |

## 3. Security & isolation
Invoices clinic-scoped (foreign read ⇒ 404, tested); totals always server-computed (client never sends amounts); audit `INVOICE_ISSUED/SIMULATED_PAYMENT_RECORDED/INVOICE_VOIDED`; no PHI in logs.

## 4. Known limitations
- Invoice lines are derived from the encounter's recorded procedures at query time (procedure voids after invoicing are reflected as line changes; totals frozen on the invoice at issue — documented trade-off, correction path = void + reissue).
- No printed/PDF invoice layout in MVP (data is API-complete).

## 5. Verdict
`READY FOR INDEPENDENT REVIEW`
