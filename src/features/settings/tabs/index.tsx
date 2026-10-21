import type { SettingsTab } from "../types";
import { GeneralTab } from "./GeneralTab";
import { OdontogramTab } from "./OdontogramTab";
import { PeriodontalTab } from "./PeriodontalTab";
import { ToothDetailsTab } from "./ToothDetailsTab";
import { CariesTab } from "./CariesTab";
import { FillingsTab } from "./FillingsTab";
import { ExportTab } from "./ExportTab";

export {
  GeneralTab,
  OdontogramTab,
  PeriodontalTab,
  ToothDetailsTab,
  CariesTab,
  FillingsTab,
  ExportTab,
};

export const SETTINGS_TABS: SettingsTab[] = [
  {
    id: "general",
    titleKey: "settings.tab.general",
    render: (ctx) => GeneralTab(ctx),
  },
  {
    id: "odontogram",
    titleKey: "settings.tab.odontogram",
    render: (ctx) => OdontogramTab(ctx),
  },
  {
    id: "periodontalChart",
    titleKey: "settings.tab.periodontalChart",
    render: (ctx) => PeriodontalTab(ctx),
  },
  {
    id: "toothDetails",
    titleKey: "settings.tab.toothDetails",
    render: (ctx) => ToothDetailsTab(ctx),
  },
  {
    id: "caries",
    titleKey: "settings.tab.caries",
    render: (ctx) => CariesTab(ctx),
  },
  {
    id: "fillings",
    titleKey: "settings.tab.fillings",
    render: (ctx) => FillingsTab(ctx),
  },
  {
    id: "export",
    titleKey: "settings.tab.export",
    render: (ctx) => ExportTab(ctx),
  },
];
