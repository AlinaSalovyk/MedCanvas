import type { PerioViewMode, PerioIndexNameMode } from "@/odontogram";
import { SelectRow, ToggleRow } from "../components/SettingControls";
import {
  PERIO_VIEW_MODE_OPTIONS,
  PERIO_INDEX_NAME_MODE_OPTIONS,
  PERIO_ROW_GROUPS,
  type TabContext,
} from "../types";

export function PeriodontalTab({ t, s }: TabContext) {
  return (
    <>
      <div className="odon-settings-group-title">{t("settings.perio.group.general")}</div>
      <ToggleRow
        t={t}
        label={t("settings.perioChart.available")}
        descKey="settings.perioChart.available.desc"
        checked={s.perioChartAvailable}
        onChange={s.onPerioChartAvailable}
      />
      <SelectRow<PerioViewMode>
        t={t}
        label={t("settings.perioViewMode")}
        descKey="settings.perioViewMode.desc"
        value={s.perioViewMode}
        options={PERIO_VIEW_MODE_OPTIONS}
        onChange={s.onPerioViewMode}
        disabled={!s.perioChartAvailable}
      />
      {PERIO_ROW_GROUPS.map((group) => (
        <div key={group.titleKey}>
          <div className="odon-settings-group-title">{t(group.titleKey)}</div>
          {group.ids.map((id) => (
            <ToggleRow
              key={id}
              t={t}
              label={t(`settings.perio.row.${id}`)}
              descKey={`settings.perio.row.${id}.desc`}
              checked={s.perioRowVisibility[id]}
              onChange={(v) => s.onPerioRowVisibility(id, v)}
              disabled={!s.perioChartAvailable}
            />
          ))}
        </div>
      ))}
      <SelectRow<PerioIndexNameMode>
        t={t}
        label={t("settings.perioIndexNameMode")}
        descKey="settings.perioIndexNameMode.desc"
        value={s.perioIndexNameMode}
        options={PERIO_INDEX_NAME_MODE_OPTIONS}
        onChange={s.onPerioIndexNameMode}
        disabled={!s.perioChartAvailable}
      />
    </>
  );
}
