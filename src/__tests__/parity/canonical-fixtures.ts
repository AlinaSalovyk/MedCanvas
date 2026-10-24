import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { defaultState, serializeState } from "../../state/payload";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const FIXTURES_DIR = path.resolve(
  __dirname,
  "../../../backend/tests/MedCanvas.Tests.Data/Fixtures/generated"
);

export function buildSyntheticFixtures(): Record<string, unknown> {
  const globals = {
    wisdomVisible: true,
    showBase: true,
    occlusalVisible: true,
    showHealthyPulp: false,
    edentulous: false,
  };

  // 1. Empty chart
  const emptyChart = {
    version: "2.22",
    globals,
    teeth: {},
  };

  // 2. Caries and restorations
  const t11 = defaultState();
  t11.caries.add("caries-distal");
  t11.caries.add("caries-mesial");
  t11.cariesActiveDepth = 2;
  t11.cariesSeverity.set("distal", 3);
  t11.cariesSeverity.set("mesial", 2);

  const t16 = defaultState();
  t16.toothSelection = "implant";
  t16.restorationType = "crown";
  t16.restorationMaterial = "zircon";

  const t21 = defaultState();
  t21.fillingSurfaces.add("occlusal");
  t21.fillingSurfaceMaterials.set("occlusal", "composite");

  const t26 = defaultState();
  t26.caries.add("caries-occlusal");
  t26.cariesSeverity.set("occlusal", 4);

  const cariesAndRestorations = {
    version: "2.22",
    globals,
    teeth: {
      "11": serializeState(t11),
      "16": serializeState(t16),
      "21": serializeState(t21),
      "26": serializeState(t26),
    },
  };

  // 3. Status and Plan
  const planT11 = defaultState();
  planT11.fillingSurfaces.add("distal");
  planT11.fillingSurfaceMaterials.set("distal", "composite");
  // @ts-expect-error planRestoration is an extensible plan property
  planT11.planRestoration = { type: "composite", shade: "A2" };

  const statusAndPlan = {
    version: "2.22",
    globals,
    teeth: {
      "11": serializeState(t11),
    },
    plan: {
      "11": serializeState(planT11),
    },
  };

  // 4. Implants and missing teeth
  const tMissing = defaultState();
  tMissing.toothSelection = "none";

  const implantsAndMissing = {
    version: "2.22",
    globals,
    teeth: {
      "18": serializeState(tMissing),
      "28": serializeState(tMissing),
      "38": serializeState(tMissing),
      "48": serializeState(tMissing),
      "16": serializeState(t16),
      "21": serializeState(defaultState()),
    },
  };

  // 5. Primary and mixed dentition
  const t51 = defaultState();
  t51.toothSelection = "milktooth";
  t51.caries.add("caries-mesial");
  t51.cariesSeverity.set("mesial", 2);

  const tMilk = defaultState();
  tMilk.toothSelection = "milktooth";

  const primaryAndMixed = {
    version: "2.22",
    globals: { ...globals, wisdomVisible: false },
    teeth: {
      "51": serializeState(t51),
      "55": serializeState(tMilk),
      "61": serializeState(tMilk),
      "71": serializeState(tMilk),
      "85": serializeState(tMilk),
    },
  };

  // 6. Endodontics
  const t36 = defaultState();
  t36.endo = "endo-filling";
  t36.periapicalType = "none";
  t36.mods.add("root-filling");

  const endodontics = {
    version: "2.22",
    globals,
    teeth: {
      "36": serializeState(t36),
    },
  };

  // 7. Periodontal
  const tPerio = defaultState();
  tPerio.perio = {
    pd: new Map([["MB", 4], ["B", 2], ["DB", 3], ["ML", 3], ["L", 2], ["DL", 4]]),
    gm: new Map([["MB", 1], ["B", 0], ["DB", 0], ["ML", 0], ["L", 0], ["DL", 1]]),
    bop: new Set(["MB", "DL"]),
    sup: new Set(),
  };

  const periodontal = {
    version: "2.22",
    globals,
    teeth: {
      "11": serializeState(tPerio),
    },
  };

  // 8. Case metadata
  const caseMetadata = {
    version: "2.22",
    globals,
    teeth: {
      "11": serializeState(defaultState()),
    },
    case: {
      patientName: "Synthetic Test Patient",
      notes: "Non-identifying synthetic test case notes",
    },
  };

  // 9. Plugin custom states
  const tPlugin = defaultState();
  tPlugin.customStates = {
    orthoSensorPlugin: {
      forceGrams: 45.5,
      bracketId: "BR-11",
    },
  };

  const pluginCustomStates = {
    version: "2.22",
    globals,
    teeth: {
      "11": serializeState(tPlugin),
    },
  };

  return {
    "empty-chart.json": emptyChart,
    "caries-and-restorations.json": cariesAndRestorations,
    "status-and-plan.json": statusAndPlan,
    "implants-and-missing-teeth.json": implantsAndMissing,
    "primary-and-mixed-dentition.json": primaryAndMixed,
    "endodontics.json": endodontics,
    "periodontal.json": periodontal,
    "case-metadata.json": caseMetadata,
    "plugin-custom-states.json": pluginCustomStates,
  };
}

export function writeCanonicalFixtures(outputDir = FIXTURES_DIR): void {
  fs.mkdirSync(outputDir, { recursive: true });
  const fixtures = buildSyntheticFixtures();
  for (const [filename, data] of Object.entries(fixtures)) {
    const filePath = path.join(outputDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
  }
}
