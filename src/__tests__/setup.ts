import '@testing-library/jest-dom/vitest';

// jsdom does not implement scrollIntoView; stub it so code paths that call it
// (e.g. the intro tour) do not crash during tests.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// jsdom does not implement window.matchMedia. The odontogram engine calls it at
// module-init time (isTouchDevice) so it must be stubbed before any test file
// imports the engine — i.e. here in the global setup file.
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// Every UI language is a lazily loaded chunk in the app (only English is
// bundled statically). Load them all up front so the suite keeps the
// synchronous semantics it was written against: `setI18nLanguage("uk")` switches
// at once and `t()` answers in Ukrainian on the next line.
import { LANGUAGES } from "../i18n/languages";
import { loadLanguage } from "../i18n/loader";
await Promise.all(LANGUAGES.map((lang) => loadLanguage(lang)));
