import type { RootCariesMode, SecondaryCariesMode, RadiographicDepthMode } from "@/odontogram";
import { SelectRow, ToggleRow } from "../components/SettingControls";
import {
  ROOT_OPTIONS,
  SECONDARY_OPTIONS,
  RADIOGRAPHIC_OPTIONS,
  type TabContext,
} from "../types";

export function CariesTab({ t, s }: TabContext) {
  return (
    <>
      <ToggleRow
        t={t}
        label={t("icdas.enable")}
        descKey="settings.icdas.desc"
        checked={s.icdas}
        onChange={s.onIcdas}
      />
      <ToggleRow
        t={t}
        label={t("settings.cariesDepth.label")}
        descKey="settings.cariesDepth.desc"
        checked={s.cariesDepth}
        onChange={s.onCariesDepth}
      />
      <SelectRow<RootCariesMode>
        t={t}
        label={t("caries.rootLabel")}
        descKey="settings.rootCaries.desc"
        value={s.rootCariesMode}
        options={ROOT_OPTIONS}
        onChange={s.onRootCariesMode}
      />
      <SelectRow<SecondaryCariesMode>
        t={t}
        label={t("caries.secondaryLabel")}
        descKey="settings.secondaryCaries.desc"
        value={s.secondaryCariesMode}
        options={SECONDARY_OPTIONS}
        onChange={s.onSecondaryCariesMode}
      />
      <SelectRow<RadiographicDepthMode>
        t={t}
        label={t("caries.radiographicLabel")}
        descKey="settings.radiographic.desc"
        value={s.radiographicDepthMode}
        options={RADIOGRAPHIC_OPTIONS}
        onChange={s.onRadiographicDepthMode}
      />
    </>
  );
}
