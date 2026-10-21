// Composable-UI Tier 3: the shared subscription hook the declarative control
// cards use. It is the reusable distillation of the hand-rolled
// `useEffect`+`onStateChange` idiom `PerioSidebar.tsx` established — read the
// engine getter at mount, then re-read it on every `onStateChange` notification
// so the card re-renders from the current chart state. Cards still read stray
// values (`getReadOnly()` etc.) inline, exactly as `PerioSidebar` does; each
// `onStateChange` re-render re-reads them too.

import { useEffect, useState } from "react";
import { onStateChange } from "../odontogram";
import { onI18nChange } from "../i18n/useI18n";

export function useEngineState<T>(read: () => T): T {
  const [v, setV] = useState(read);
  useEffect(() => {
    setV(read());
    const unsubState = onStateChange(() => setV(read()));
    const unsubI18n = onI18nChange(() => setV(read()));
    return () => {
      unsubState();
      unsubI18n();
    };
  }, []);
  return v;
}
