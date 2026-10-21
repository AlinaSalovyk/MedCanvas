# Contributing

Thank you for thinking about contributing to Advanced Odontogram. Bug
reports, fixes, translations, anatomy work and new features are all welcome, and
every contributor is credited in the app.

## Getting set up

This is a standalone React and TypeScript web application built with Vite.

- Install dependencies: `npm install`
- Run the dev server: `npm run dev`
- Type check: `npx tsc -b --noEmit`
- Lint: `npm run lint`
- Test: `npm test` (Vitest)
- E2E Tests: `npm run test:e2e` (Playwright)
- Build the web application: `npm run build`

## Before you open a pull request

- Keep changes small and focused. One topic per pull request is much easier to
  review.
- Run the type check, the linter and the full test suite. They should all pass.
- Add or update tests for anything you change.
- The project keeps golden fixtures for the rendered SVG, the shell DOM, the FHIR
  export and the JSON round trip. If your change is meant to preserve behaviour,
  those goldens must stay byte identical. If it changes output on purpose,
  regenerate the affected golden and say why in the pull request.

## Translations and i18n

All user facing text lives in `src/i18n/locales/en.ts` and `src/i18n/locales/uk.ts`. English is the
authoritative key set. The UI currently ships in two languages: English (`en`) and Ukrainian (`uk`).

## Adding a National Diagnosis-Coding Pack

See [`CODING_PACKS.md`](./CODING_PACKS.md) for a step-by-step guide to add your
country's national diagnosis codes (e.g., BNO-10 for Hungary, ICD-10-CM for the US).

## Style

- Follow the patterns already in the surrounding code.
- Prefer explicit, readable logic over clever shortcuts.
- Do not add heavy dependencies. The bundle is meant to stay small.
- Public API changes must stay backward compatible, and the JSON payload version
  is bumped whenever the serialized shape changes.

## Documentation

Updating the documentation is part of the change, not an afterthought. Update
`README.md` and the relevant technical references in `docs/` (`docs/architecture.md`,
`docs/clinical-state.md`, `docs/engine-lifecycle.md`, `docs/testing.md`) when
behaviour, architecture, or the public API changes.

## Credit

When your pull request is merged you are added to the Credits popup in the app.
If we miss you, please say so and we will put it right.
