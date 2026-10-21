// The UI strings, loaded on demand.
//
// English — the default fallback and the language the UI starts in — is bundled
// statically in the main bundle; Ukrainian is loaded on demand as its own chunk
// the first time it is selected.
//
// `t()` stays synchronous. That works because nothing reads a language before
// it has been loaded: `setI18nLanguage()` loads first and flips second, and the
// React provider holds its first render until the requested language is in.
import en from "./locales/en";
import { resolveLanguage, type Language } from "./languages";

type Table = Record<string, string>;

const tables: Partial<Record<Language, Table>> = { en };
const inflight = new Map<Language, Promise<Table>>();

// One LITERAL `import()` per language. That is what makes the bundler emit a
// separate chunk for each; a template-string import would be analysed as a glob
// over the folder, which also matches the statically imported `en` above.
const LOADERS: Record<Exclude<Language, "en">, () => Promise<{ default: Table }>> = {
  uk: () => import("./locales/uk"),
};

/** Whether a language's strings are available (synchronously) right now. */
export function isLanguageLoaded(lang: Language): boolean {
  const resolved = resolveLanguage(lang);
  return tables[resolved] !== undefined;
}

/** A loaded language's string table, or `undefined` if it has not arrived yet. */
export function getLoadedTable(lang: Language): Table | undefined {
  const resolved = resolveLanguage(lang);
  return tables[resolved];
}

/**
 * Fetch a language's strings. Resolves at once for one already loaded; concurrent
 * calls share a single request. A FAILED load (offline, a chunk missing from a
 * deploy) is not cached, so the next call retries instead of being stuck for the
 * rest of the session. Rejects on failure — `setI18nLanguage()` is the caller
 * that turns that into "stay on the current language".
 */
export function loadLanguage(lang: Language): Promise<void> {
  const resolved = resolveLanguage(lang);
  if(tables[resolved]) return Promise.resolve();
  let pending = inflight.get(resolved);
  if(!pending){
    const loader = LOADERS[resolved as Exclude<Language, "en">];
    if(!loader){
      return Promise.resolve();
    }
    pending = loader()
      .then((m) => (tables[resolved] = m.default))
      .finally(() => { inflight.delete(resolved); });
    inflight.set(resolved, pending);
  }
  return pending.then(() => undefined);
}
