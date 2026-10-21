import { SelectRow, ToggleRow } from "../components/SettingControls";
import {
  FILLING_COMPLEXITY_OPTIONS,
  FILLING_MATERIAL_KEYS,
  FILLING_MATERIAL_LABEL_KEYS,
  type FillingComplexity,
  type TabContext,
} from "../types";

export function FillingsTab({ t, s }: TabContext) {
  return (
    <>
      <ToggleRow
        t={t}
        label={t("settings.filling.defect")}
        descKey="settings.filling.defect.desc"
        checked={s.fillingDefectEnabled}
        onChange={s.onFillingDefectEnabled}
      />
      <SelectRow<FillingComplexity>
        t={t}
        label={t("settings.filling.complexity")}
        descKey="settings.filling.complexity.desc"
        value={s.fillingComplexity}
        options={FILLING_COMPLEXITY_OPTIONS}
        onChange={s.onFillingComplexity}
      />
      <div className="odon-settings-group-title">{t("settings.filling.materials")}</div>
      {FILLING_MATERIAL_KEYS.map((m) => (
        <ToggleRow
          key={m}
          t={t}
          label={t(FILLING_MATERIAL_LABEL_KEYS[m])}
          descKey="settings.filling.material.desc"
          checked={s.fillingMaterials[m] ?? true}
          onChange={(v) => s.onFillingMaterial(m, v)}
        />
      ))}
      <ToggleRow
        t={t}
        label={t("settings.filling.fissure")}
        descKey="settings.filling.fissure.desc"
        checked={s.fissureSealingEnabled}
        onChange={s.onFissureSealingEnabled}
      />
    </>
  );
}
