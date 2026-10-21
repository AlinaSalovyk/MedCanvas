import type { SelectionBorderStyle } from "@/state/displaySettings";
import type { PulpDetailLevel, ToothDetailLevel, SurfaceNotation } from "@/odontogram";
import { InputRow, SelectRow, ToggleRow } from "../components/SettingControls";
import {
  SELECTION_BORDER_OPTIONS,
  PULP_OPTIONS,
  TOOTH_DETAIL_OPTIONS,
  SURFACE_NOTATION_OPTIONS,
  type TabContext,
} from "../types";

export function ToothDetailsTab({ t, s }: TabContext) {
  return (
    <>
      <InputRow
        t={t}
        label={t("settings.selection.color")}
        descKey="settings.selection.color.desc"
        type="color"
        value={s.selectionColor}
        onChange={s.onSelectionColor}
      />
      <SelectRow<SelectionBorderStyle>
        t={t}
        label={t("settings.selection.border")}
        descKey="settings.selection.border.desc"
        value={s.selectionBorderStyle}
        options={SELECTION_BORDER_OPTIONS}
        onChange={s.onSelectionBorderStyle}
      />
      <SelectRow<PulpDetailLevel>
        t={t}
        label={t("pulp.level.label")}
        descKey="settings.pulpLevel.desc"
        value={s.pulpLevel}
        options={PULP_OPTIONS}
        onChange={s.onPulpLevel}
      />
      <SelectRow<ToothDetailLevel>
        t={t}
        label={t("settings.wearDetail.label")}
        descKey="settings.wearDetail.desc"
        value={s.wearDetailLevel}
        options={TOOTH_DETAIL_OPTIONS}
        onChange={s.onWearDetailLevel}
      />
      <SelectRow<ToothDetailLevel>
        t={t}
        label={t("settings.discolorationDetail.label")}
        descKey="settings.discolorationDetail.desc"
        value={s.discolorationDetailLevel}
        options={TOOTH_DETAIL_OPTIONS}
        onChange={s.onDiscolorationDetailLevel}
      />
      <SelectRow<SurfaceNotation>
        t={t}
        label={t("settings.surfaceNotation.label")}
        descKey="settings.surfaceNotation.desc"
        value={s.surfaceNotation}
        options={SURFACE_NOTATION_OPTIONS}
        onChange={s.onSurfaceNotation}
      />
      <ToggleRow
        t={t}
        label={t("settings.notes")}
        descKey="settings.notes.desc"
        checked={s.notes}
        onChange={s.onNotes}
      />
    </>
  );
}
