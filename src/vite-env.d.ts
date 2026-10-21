/// <reference types="vite/client" />

/** Build-time injected package version (see `define` in the vite/vitest
 *  configs). Used by the PDF report footer's version stamp. */
declare const __APP_VERSION__: string;
