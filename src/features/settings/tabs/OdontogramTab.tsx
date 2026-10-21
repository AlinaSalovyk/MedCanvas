import type { ScreenToothSpacing, ScreenToothNumberSize } from "@/state/displaySettings";
import type { ToothAnatomy } from "@/odontogram";
import { SelectRow, ToggleRow } from "../components/SettingControls";
import {
  SCREEN_SPACING_OPTIONS,
  SCREEN_NUMBER_SIZE_OPTIONS,
  TOOTH_ANATOMY_OPTIONS,
  type TabContext,
} from "../types";

export function OdontogramTab({ t, s }: TabContext) {
  return (
    <>
      <ToggleRow
        t={t}
        label={t("settings.planMode")}
        descKey="settings.planMode.desc"
        checked={s.planModeAvailable}
        onChange={s.onPlanModeAvailable}
      />
      <SelectRow<ScreenToothSpacing>
        t={t}
        label={t("settings.screen.spacing")}
        descKey="settings.screen.spacing.desc"
        value={s.screenToothSpacing}
        options={SCREEN_SPACING_OPTIONS}
        onChange={s.onScreenToothSpacing}
      />
      <SelectRow<ScreenToothNumberSize>
        t={t}
        label={t("settings.screen.numberSize")}
        descKey="settings.screen.numberSize.desc"
        value={s.screenToothNumberSize}
        options={SCREEN_NUMBER_SIZE_OPTIONS}
        onChange={s.onScreenToothNumberSize}
      />
      <SelectRow<ToothAnatomy>
        t={t}
        label={t("settings.toothAnatomy")}
        descKey="settings.toothAnatomy.desc"
        value={s.toothAnatomy}
        options={TOOTH_ANATOMY_OPTIONS}
        onChange={s.onToothAnatomy}
      />
      <ToggleRow
        t={t}
        label={t("settings.toothInfo")}
        descKey="settings.toothInfo.desc"
        checked={s.toothInfo}
        onChange={s.onToothInfo}
      />
      <ToggleRow
        t={t}
        label={t("settings.panels.statuses")}
        descKey="settings.panels.statuses.desc"
        checked={s.showStatusCard}
        onChange={s.onShowStatusCard}
      />
      <ToggleRow
        t={t}
        label={t("settings.panels.orthodontics")}
        descKey="settings.panels.orthodontics.desc"
        checked={s.showOrthoCard}
        onChange={s.onShowOrthoCard}
      />
    </>
  );
}
