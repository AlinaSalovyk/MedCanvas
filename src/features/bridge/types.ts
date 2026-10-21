/** Minimal shape of tooth state this module reads. */
export interface BridgeToothState {
  restorationType?: string;
  restorationMaterial?: string;
  bridgePillar?: boolean;
}

/** Reads a tooth's current state by FDI tooth number. May return undefined. */
export type GetToothState = (toothNo: number) => BridgeToothState | undefined | null;

/** Maps a restoration material key to a solid CSS color for the saddle bar. */
export type MaterialColor = (material: string) => string;

/** A tile's box in grid-relative coordinates (x = left - gridLeft, etc.). */
export interface GridRelativeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Resolves a tooth's tile box in grid-relative coordinates, or null if hidden. */
export type RectFor = (toothNo: number) => GridRelativeRect | null;

/** A single saddle bar to draw, in grid-relative coordinates. */
export interface BridgeBar {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
}

/** Dependencies for {@link renderBridgeOverlay}. */
export interface RenderBridgeOverlayDeps {
  /** The `#toothGrid` element (host of the overlay). */
  grid: HTMLElement | null;
  /** Reads a tooth's state by FDI number. */
  getState: GetToothState;
  /** Optional material -> color resolver; defaults to {@link defaultMaterialColor}. */
  materialColor?: MaterialColor;
}
