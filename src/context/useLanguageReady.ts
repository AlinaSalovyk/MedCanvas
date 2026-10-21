import { useEffect, useState } from "react";
import { isLanguageLoaded, loadLanguage } from "@/i18n/loader";
import { resolveLanguage, type Language } from "@/i18n/languages";

/**
 * Whether the provider may render yet. Gates the FIRST render only: once it
 * has been true it stays true, because returning `null` later would unmount
 * the whole chart — engine, selection and all — just to switch language. A
 * switch after mount is handled by `useI18n`, which keeps the previous
 * language on screen until the new one arrives.
 *
 * A load that FAILS still opens the gate: rendering in the English fallback
 * beats rendering nothing forever, and `setI18nLanguage()` reports the error.
 */
export function useLanguageReady(language: Language | undefined): boolean {
  const resolved = language !== undefined ? resolveLanguage(language) : undefined;
  const [ready, setReady] = useState(() => resolved === undefined || isLanguageLoaded(resolved));

  useEffect(() => {
    if (ready) return;
    if (resolved === undefined || isLanguageLoaded(resolved)) {
      setReady(true);
      return;
    }
    let cancelled = false;
    const open = () => {
      if (!cancelled) setReady(true);
    };
    loadLanguage(resolved).then(open, open);
    return () => {
      cancelled = true;
    };
  }, [resolved, ready]);

  return ready;
}
