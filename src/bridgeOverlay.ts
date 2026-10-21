/**
 * Multi-tooth bridge-span OVERLAY subsystem.
 *
 * Facade module re-exporting bridge domain types, constants, detection,
 * geometry calculations, and SVG rendering from `src/features/bridge/`.
 */

export type {
  BridgeToothState,
  GetToothState,
  MaterialColor,
  GridRelativeRect,
  RectFor,
  BridgeBar,
  RenderBridgeOverlayDeps,
} from "./features/bridge/types";

export {
  SVG_NS,
  UPPER_ARCH,
  LOWER_ARCH,
  ARCHES,
  SADDLE_Y_FRACTION,
  SADDLE_Y_FRACTION_LOWER,
  SADDLE_THICKNESS,
  SADDLE_OVERLAP,
  DEFAULT_MATERIAL_COLORS,
  BRIDGE_OVERLAY_CLASS,
  BRIDGE_BAR_CLASS,
} from "./features/bridge/constants";

export {
  defaultMaterialColor,
  detectBridgeSpans,
  spanMaterial,
} from "./features/bridge/detection";

export {
  sideTile,
  tileRectFor,
  computeBridgeBars,
} from "./features/bridge/geometry";

export {
  barRect,
  renderBridgeOverlay,
} from "./features/bridge/render";
