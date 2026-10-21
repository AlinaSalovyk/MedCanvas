// EVERY locale, statically imported — for tests and tooling only.
//
// Application code must never import this module's value: doing so would pull
// all languages back into the main bundle, which is exactly what
// `./loader.ts` exists to avoid. The UI reads strings through `t()` in
// `./useI18n.ts`. A guard test (`i18n-lazy-load.test.ts`) fails if any
// non-test module imports this file.
//
// The key-completeness tests use it to check that Ukrainian carries the
// same set of keys as English, the authoritative source.
import type { Language } from "./languages";
import en from "./locales/en";
import uk from "./locales/uk";

export type { Language } from "./languages";

/**
 * Master translation table keyed by {@link Language}. English (`en`) is the
 * authoritative source — Ukrainian (`uk`) must contain exactly the same
 * set of keys. Template placeholders use `{{name}}` syntax.
 */
export const translations: Record<Language, Record<string, string>> = {
  en,
  uk,
};
