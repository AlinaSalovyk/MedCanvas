# MedCanvas MVP — Progress Checkpoint

Last audit: 2026-10-28. Current acceptance is **INCONCLUSIVE — REQUIRED VERIFICATION INCOMPLETE**.
Merged implementation modules do not establish that final acceptance/security gates passed.

## Verified module provenance

These merge commits are present in fetched main, independently verified at
`d1d67daa75a6b818730c56638a529b4aad52326f`.

| Module | PR | Merge SHA | State |
|---|---|---|---|
| M00 Clinical safety | [#3](https://github.com/AlinaSalovyk/MedCanvas/pull/3) | `2b59f50947eb7623edd803a92bf98f4b16843c05` | MERGED |
| M01 Identity/workspace | [#4](https://github.com/AlinaSalovyk/MedCanvas/pull/4) | `c07182ab571238c6324ec79190d982d2bc0f1259` | MERGED |
| M02 Patients | [#5](https://github.com/AlinaSalovyk/MedCanvas/pull/5) | `a953ac914212b5a682f34a506063daf15f41d354` | MERGED |
| M03 Scheduling | [#6](https://github.com/AlinaSalovyk/MedCanvas/pull/6) | `7d309b955e7834c94b18c3f867cda2a655800433` | MERGED |
| M04 Clinical workspace | [#7](https://github.com/AlinaSalovyk/MedCanvas/pull/7) | `6b365bad75b31007c585e68389f81ea037e17cf4` | MERGED |
| M05 Plans | [#8](https://github.com/AlinaSalovyk/MedCanvas/pull/8) | `5d6b0ad5497180dafa31daff9bf1d5a5eec98661` | MERGED |
| M06 Execution | [#9](https://github.com/AlinaSalovyk/MedCanvas/pull/9) | `fbbfdce7cc893d220a13db7e125e9975be927ac0` | MERGED |
| M07 Demo billing | [#10](https://github.com/AlinaSalovyk/MedCanvas/pull/10) | `bc9a13c75cd77f1f12ae8fc0e00e2ce48f1eaea9` | MERGED |
| M08 Follow-up/dashboard | [#11](https://github.com/AlinaSalovyk/MedCanvas/pull/11) | `3ad32b4188c1484bf474b6e89811128b7a837863` | MERGED |
| M09 API workflow | [#12](https://github.com/AlinaSalovyk/MedCanvas/pull/12) | `d1d67daa75a6b818730c56638a529b4aad52326f` | MERGED |
| Final stabilization | Branch `AlinaSalovyk:fix/mvp-release-hardening` | Not merged | DRAFT / RELEASE BLOCKED |

## Current work and evidence

The [post-M09 report](post-m09-hardening-report.md) records findings, corrected
financial/scheduling policies, legacy migration handling and real-browser setup.
`npm run test:e2e:fullstack` runs against real ASP.NET/PostgreSQL with synthetic
clinics in Kyiv and New York browser zones. Existing mocked browser tests remain.

Final local results and hosted CI HEAD are maintained in that report and the
stabilization PR. No test count copied from an older module establishes current
readiness. The historical unconditional completion verdict is withdrawn.

## Release blockers and documentation reconciliation

- A credential embedded in the local Git remote was exposed during preflight.
  The URL is sanitized; credential revocation/rotation is unverified. Automatic
  merge is stopped under the owner's explicit hard-stop rule.
- Hosted CI must be verified on the final owner-branch HEAD. Local final results:
  backend 525/525; Vitest 2693 passed/2 existing skips; existing Chromium 17/17;
  real full-stack browser 2/2 (Kyiv/New York). TypeScript/lint/build/format pass.
- Application source coverage is 88.27%, below the backend skill's 95% target.
- Coverage, dirty-chart authentication expiry, backup/restore and FR-702
  relational follow-up acceptance require explicit review.
- PR #13 is closed without merging. PR #14 was inspected: it is documentation
  only and still claims unconditional program completion. It must not merge as
  written. The stabilization report/progress correction supersedes that claim;
  publication uses the repository owner's account and repository branch.
  Closing/updating PR #14 and merging upstream main remain unperformed.

No production deployment or real clinical/payment data is authorized by these tests.
