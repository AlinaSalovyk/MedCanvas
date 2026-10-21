/**
 * Supported UI languages.
 *
 * | Code  | Language    |
 * |-------|-------------|
 * | en    | English     |
 * | uk    | Ukrainian   |
 *
 * The strings themselves live one file per language in `./locales/`. Only
 * English is bundled statically; Ukrainian is a separate chunk fetched the first
 * time it is selected (see `./loader.ts`).
 */
export type Language = "en" | "uk";

/** Every supported language, in the order the language menu lists them. */
export const LANGUAGES: readonly Language[] = ["en", "uk"];

/** The language every missing key resolves against, and the one the UI starts in. */
export const FALLBACK_LANGUAGE: Language = "en";

/**
 * Resolve an arbitrary language code to a supported language.
 * Unrecognized or legacy language codes (e.g. from previously saved user preferences)
 * are safely resolved to the default fallback (`"en"`).
 */
export function resolveLanguage(lang: unknown): Language {
  if (typeof lang === "string" && (lang === "en" || lang === "uk")) {
    return lang as Language;
  }
  return FALLBACK_LANGUAGE;
}
