export let wisdomVisible = true;
export let showBase = true;
export let occlusalVisible = true;
export let showHealthyPulp = true;
export let edentulous = false;
export let suppressEdentulousSync = false;
export let readOnly = false;

export function setWisdomVisibleState(on: boolean): void { wisdomVisible = on; }
export function setShowBaseState(on: boolean): void { showBase = on; }
export function setOcclusalVisibleState(on: boolean): void { occlusalVisible = on; }
export function setHealthyPulpVisibleState(on: boolean): void { showHealthyPulp = on; }
export function setEdentulousState(on: boolean): void { edentulous = on; }
export function setSuppressEdentulousSyncState(on: boolean): void { suppressEdentulousSync = on; }
export function setReadOnlyState(on: boolean): void { readOnly = on; }

export function getEdentulous(): boolean { return edentulous; }
export function getReadOnly(): boolean { return readOnly; }

/**
 * TEST-ONLY hook to manipulate showHealthyPulp without DOM side-effects.
 */
export function __setShowHealthyPulpForTest(on: boolean): void {
  showHealthyPulp = !!on;
}
