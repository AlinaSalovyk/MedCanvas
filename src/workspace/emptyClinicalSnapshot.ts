import { ALL_TEETH } from "../anatomy/profiles";
import { defaultState, serializeState } from "../state/payload";

/** A new examination starts from canonical defaults, never from the singleton's
 * previous patient's chart or local-storage contents. */
export function emptyClinicalSnapshot(): string {
  return JSON.stringify({
    version: "2.22",
    globals: { wisdomVisible: true, showBase: true, occlusalVisible: true, showHealthyPulp: false, edentulous: false },
    teeth: Object.fromEntries(ALL_TEETH.map(fdi => [String(fdi), serializeState(defaultState())])),
  });
}
