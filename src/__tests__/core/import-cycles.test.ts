// No circular imports in src/.
//
// Splitting odontogram.ts moved several slices into their own modules, and each
// one is a chance to create a cycle back into the engine — the failure mode is
// nasty (a module reads a partially-initialized import and gets `undefined` at
// module-eval time, often only in the built bundle, not in tests). The engine
// avoids this by construction: extracted modules never import odontogram.ts,
// and the places that genuinely need to call back into it use an injected hook.
//
// Stage 21 enhancement:
// 1. Full alias resolution for `@/` -> `src/` (matches tsconfig paths & vite alias).
// 2. TypeScript Compiler API AST traversal replaces fragile regular expressions.
// 3. Strict separation of runtime vs. type-only imports/exports: type-only relationships
//    do not cause module evaluation deadlocks and are excluded from the runtime graph.
// 4. Asset (.svg, .png, .css, etc.) and external package filtering prevents fake graph edges.
// 5. Dynamic `import()` is excluded with documented rationale (asynchronous on-demand loading
//    cannot deadlock synchronous module evaluation).
// 6. Explicit tracking of unresolved internal imports.
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import * as ts from "typescript";

export const SRC = path.resolve(__dirname, "../..");
export const CODE_EXT = [".ts", ".tsx"];
export const NON_CODE_EXT = [
  ".css", ".scss", ".sass", ".less",
  ".svg", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico",
  ".json", ".woff", ".woff2", ".ttf", ".eot"
];

export interface FileSystemProvider {
  existsSync(p: string): boolean;
  statSync(p: string): { isFile(): boolean };
  readFileSync(p: string, encoding?: "utf8" | string): string;
}

export const defaultFs: FileSystemProvider = {
  existsSync,
  statSync: (p: string) => statSync(p),
  readFileSync: (p: string, enc = "utf8") => readFileSync(p, enc as BufferEncoding),
};

export function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "__tests__" || name === "assets" || name === "node_modules") continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (CODE_EXT.includes(path.extname(name)) && !name.endsWith(".d.ts")) out.push(full);
  }
  return out;
}

export interface ResolveResult {
  kind: "relative" | "alias" | "external" | "asset" | "unresolved";
  target: string | null;
  spec: string;
}

/**
 * Resolve a specifier (relative or @/ alias) to an actual TypeScript/React code module.
 * External packages (e.g. "react", "dompurify") and non-code assets (e.g. ".css", ".svg")
 * are identified and excluded so they do not produce fake graph edges.
 */
export function resolveSpecifier(
  fromFile: string,
  rawSpec: string,
  srcDir: string = SRC,
  fsProvider: Pick<FileSystemProvider, "existsSync" | "statSync"> = defaultFs
): ResolveResult {
  const cleanSpec = rawSpec.split("?")[0];
  let base: string;
  let kind: "relative" | "alias";

  if (cleanSpec.startsWith(".")) {
    base = path.resolve(path.dirname(fromFile), cleanSpec);
    kind = "relative";
  } else if (cleanSpec.startsWith("@/")) {
    base = path.resolve(srcDir, cleanSpec.slice(2));
    kind = "alias";
  } else {
    // External package import (e.g. react, dompurify, fhir/r4)
    return { kind: "external", target: null, spec: rawSpec };
  }

  const ext = path.extname(base).toLowerCase();
  if (ext && NON_CODE_EXT.includes(ext)) {
    // Static asset import (e.g. svg, css, png)
    return { kind: "asset", target: null, spec: rawSpec };
  }

  const candidates: string[] = [];
  if (CODE_EXT.includes(ext)) {
    candidates.push(base);
  } else {
    for (const e of CODE_EXT) candidates.push(base + e);
    for (const e of CODE_EXT) candidates.push(path.join(base, "index" + e));
    candidates.push(base);
  }

  for (const cand of candidates) {
    try {
      if (fsProvider.existsSync(cand) && fsProvider.statSync(cand).isFile()) {
        return { kind, target: cand, spec: rawSpec };
      }
    } catch {
      // Continue to next candidate
    }
  }

  return { kind: "unresolved", target: null, spec: rawSpec };
}

export interface ExtractedSpecifier {
  specifier: string;
  isRuntime: boolean;
}

/**
 * Extract import and export declarations using the TypeScript compiler AST.
 *
 * Distinguishes runtime imports from type-only imports:
 * - Runtime imports (side-effect `import "./a"`, default, named, namespace, and re-exports)
 *   force evaluation of the referenced module during initialization.
 * - Type-only imports (`import type`, `export type`, or all type-only specifiers) are
 *   erased during compilation and cannot cause runtime evaluation cycles.
 * - Dynamic `import()` returns a Promise evaluated asynchronously on demand (e.g. jsPDF,
 *   fonts) and cannot deadlock synchronous module initialization; it is excluded.
 */
export function extractSpecifiers(sourceText: string, filePath = "module.ts"): ExtractedSpecifier[] {
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);
  const results: ExtractedSpecifier[] = [];

  function isRuntimeImport(node: ts.ImportDeclaration): boolean {
    if (!node.importClause) {
      // import "./polyfill"; (side-effect import is runtime)
      return true;
    }
    if (node.importClause.isTypeOnly) {
      return false;
    }
    if (node.importClause.name) {
      // import Foo from "./foo"; (default import is runtime)
      return true;
    }
    const nb = node.importClause.namedBindings;
    if (!nb) {
      return false;
    }
    if (ts.isNamespaceImport(nb)) {
      // import * as Foo from "./foo";
      return true;
    }
    if (ts.isNamedImports(nb)) {
      if (nb.elements.length === 0) return true;
      return nb.elements.some((el) => !el.isTypeOnly);
    }
    return true;
  }

  function isRuntimeExport(node: ts.ExportDeclaration): boolean {
    if (!node.moduleSpecifier) return false;
    if (node.isTypeOnly) return false;
    if (!node.exportClause) {
      // export * from "./foo";
      return true;
    }
    if (ts.isNamespaceExport && ts.isNamespaceExport(node.exportClause)) {
      // export * as Foo from "./foo";
      return true;
    }
    if (ts.isNamedExports(node.exportClause)) {
      if (node.exportClause.elements.length === 0) return true;
      return node.exportClause.elements.some((el) => !el.isTypeOnly);
    }
    return true;
  }

  ts.forEachChild(sourceFile, (node) => {
    if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      results.push({
        specifier: node.moduleSpecifier.text,
        isRuntime: isRuntimeImport(node),
      });
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      results.push({
        specifier: node.moduleSpecifier.text,
        isRuntime: isRuntimeExport(node),
      });
    }
  });

  return results;
}

export interface GraphSummary {
  graph: Map<string, string[]>;
  relativeEdges: number;
  aliasEdges: number;
  externalPackages: number;
  nonCodeAssets: number;
  unresolved: Array<{ file: string; spec: string }>;
}

export function buildGraph(
  files: string[],
  srcDir: string = SRC,
  fsProvider: FileSystemProvider = defaultFs
): GraphSummary {
  const graph = new Map<string, string[]>();
  let relativeEdges = 0;
  let aliasEdges = 0;
  let externalPackages = 0;
  let nonCodeAssets = 0;
  const unresolved: Array<{ file: string; spec: string }> = [];

  for (const file of files) {
    const src = fsProvider.readFileSync(file, "utf8");
    const extracted = extractSpecifiers(src, file);
    const deps: string[] = [];

    for (const item of extracted) {
      if (!item.isRuntime) {
        // Exclude type-only relationships from runtime module initialization graph
        continue;
      }
      const res = resolveSpecifier(file, item.specifier, srcDir, fsProvider);
      switch (res.kind) {
        case "relative":
          relativeEdges++;
          if (res.target) deps.push(res.target);
          break;
        case "alias":
          aliasEdges++;
          if (res.target) deps.push(res.target);
          break;
        case "external":
          externalPackages++;
          break;
        case "asset":
          nonCodeAssets++;
          break;
        case "unresolved":
          unresolved.push({ file, spec: item.specifier });
          break;
      }
    }
    graph.set(file, deps);
  }

  return {
    graph,
    relativeEdges,
    aliasEdges,
    externalPackages,
    nonCodeAssets,
    unresolved,
  };
}

/** Every elementary cycle, as readable src-relative paths. */
export function findCycles(graph: Map<string, string[]>, srcDir: string = SRC): string[][] {
  const cycles: string[][] = [];
  const state = new Map<string, 0 | 1 | 2>(); // 0 unseen, 1 on stack, 2 done
  const stack: string[] = [];

  const visit = (node: string) => {
    state.set(node, 1);
    stack.push(node);
    for (const dep of graph.get(node) ?? []) {
      const s = state.get(dep) ?? 0;
      if (s === 1) {
        cycles.push(
          [...stack.slice(stack.indexOf(dep)), dep].map((f) =>
            path.relative(srcDir, f).split(path.sep).join("/")
          )
        );
      } else if (s === 0) {
        visit(dep);
      }
    }
    stack.pop();
    state.set(node, 2);
  };

  for (const node of graph.keys()) {
    if ((state.get(node) ?? 0) === 0) visit(node);
  }
  return cycles;
}

/** Create an in-memory virtual file system for deterministic regression testing. */
export function createVirtualFs(files: Record<string, string>, srcDir = path.resolve(SRC, "__virtual_fixture__")) {
  const normMap = new Map<string, string>();
  for (const [p, content] of Object.entries(files)) {
    const full = path.isAbsolute(p) ? path.normalize(p) : path.normalize(path.join(srcDir, p));
    normMap.set(full, content);
  }
  return {
    srcDir,
    existsSync(p: string) {
      return normMap.has(path.normalize(p));
    },
    statSync(p: string) {
      const exists = normMap.has(path.normalize(p));
      return { isFile: () => exists };
    },
    readFileSync(p: string) {
      const content = normMap.get(path.normalize(p));
      if (content === undefined) throw new Error("File not found: " + p);
      return content;
    },
    getAllFiles() {
      return Array.from(normMap.keys()).filter((p) => CODE_EXT.includes(path.extname(p)));
    },
  };
}

describe("guard regression coverage (isolated in-memory fixtures)", () => {
  it("1. relative imports resolve (.ts, .tsx, index.ts)", () => {
    const vfs = createVirtualFs({
      "a.ts": 'import { b } from "./b"; import { c } from "./c"; import { d } from "./sub";',
      "b.ts": "export const b = 1;",
      "c.tsx": "export const c = 2;",
      "sub/index.ts": "export const d = 3;",
    });
    const summary = buildGraph(vfs.getAllFiles(), vfs.srcDir, vfs);
    expect(summary.relativeEdges).toBe(3);
    expect(summary.unresolved).toEqual([]);
    const aDeps = summary.graph.get(path.normalize(path.join(vfs.srcDir, "a.ts"))) ?? [];
    expect(aDeps).toHaveLength(3);
  });

  it("2. @/ aliases resolve to src/ root (.ts, .tsx, index.ts)", () => {
    const vfs = createVirtualFs({
      "feature/a.ts": 'import { b } from "@/b"; import { c } from "@/components/c"; import { d } from "@/sub";',
      "b.ts": "export const b = 1;",
      "components/c.tsx": "export const c = 2;",
      "sub/index.ts": "export const d = 3;",
    });
    const summary = buildGraph(vfs.getAllFiles(), vfs.srcDir, vfs);
    expect(summary.aliasEdges).toBe(3);
    expect(summary.unresolved).toEqual([]);
    const aDeps = summary.graph.get(path.normalize(path.join(vfs.srcDir, "feature/a.ts"))) ?? [];
    expect(aDeps).toHaveLength(3);
  });

  it("3. static re-exports are included (export ... from and export * from)", () => {
    const vfs = createVirtualFs({
      "index.ts": 'export { b } from "./b"; export * from "@/c"; export * as d from "./d";',
      "b.ts": "export const b = 1;",
      "c.ts": "export const c = 2;",
      "d.ts": "export const d = 3;",
    });
    const summary = buildGraph(vfs.getAllFiles(), vfs.srcDir, vfs);
    expect(summary.relativeEdges + summary.aliasEdges).toBe(3);
    expect(summary.unresolved).toEqual([]);
  });

  it("4. static side-effect imports are included", () => {
    const vfs = createVirtualFs({
      "main.ts": 'import "./init"; import "@/polyfill";',
      "init.ts": "console.log('init');",
      "polyfill.ts": "console.log('polyfill');",
    });
    const summary = buildGraph(vfs.getAllFiles(), vfs.srcDir, vfs);
    expect(summary.relativeEdges).toBe(1);
    expect(summary.aliasEdges).toBe(1);
    expect(summary.unresolved).toEqual([]);
  });

  it("5. artificial alias-only cycle is detected", () => {
    const vfs = createVirtualFs({
      "alpha.ts": 'import { beta } from "@/beta"; export const alpha = 1;',
      "beta.ts": 'import { alpha } from "@/alpha"; export const beta = 2;',
    });
    const summary = buildGraph(vfs.getAllFiles(), vfs.srcDir, vfs);
    expect(summary.aliasEdges).toBe(2);
    const cycles = findCycles(summary.graph, vfs.srcDir);
    expect(cycles.length).toBeGreaterThan(0);
    const normalized = cycles.map((c) => c.join(" -> "));
    expect(normalized.some((c) => c.includes("alpha.ts") && c.includes("beta.ts"))).toBe(true);
  });

  it("6. mixed relative/alias cycle is detected", () => {
    const vfs = createVirtualFs({
      "dir/one.ts": 'import { two } from "./two"; export const one = 1;',
      "dir/two.ts": 'import { three } from "@/dir/three"; export const two = 2;',
      "dir/three.ts": 'import { one } from "./one"; export const three = 3;',
    });
    const summary = buildGraph(vfs.getAllFiles(), vfs.srcDir, vfs);
    expect(summary.relativeEdges).toBe(2);
    expect(summary.aliasEdges).toBe(1);
    const cycles = findCycles(summary.graph, vfs.srcDir);
    expect(cycles.length).toBeGreaterThan(0);
    const normalized = cycles.map((c) => c.join(" -> "));
    expect(normalized.some((c) => c.includes("dir/one.ts") && c.includes("dir/two.ts") && c.includes("dir/three.ts"))).toBe(true);
  });

  it("7. external packages and non-code assets are excluded", () => {
    const vfs = createVirtualFs({
      "app.ts": 'import React from "react"; import { sanitize } from "dompurify"; import "./theme.css"; import logo from "./logo.svg";',
      "theme.css": "body { margin: 0; }",
      "logo.svg": "<svg></svg>",
    });
    const summary = buildGraph(vfs.getAllFiles(), vfs.srcDir, vfs);
    expect(summary.externalPackages).toBe(2);
    expect(summary.nonCodeAssets).toBe(2);
    expect(summary.relativeEdges).toBe(0);
    expect(summary.aliasEdges).toBe(0);
    expect(summary.unresolved).toEqual([]);
    const appDeps = summary.graph.get(path.normalize(path.join(vfs.srcDir, "app.ts"))) ?? [];
    expect(appDeps).toEqual([]);
  });

  it("8. type-only imports do not falsely create runtime cycles", () => {
    const vfs = createVirtualFs({
      "model.ts": 'import { helper } from "./helper"; export interface Model { id: string; }',
      "helper.ts": 'import type { Model } from "./model"; import { type Model as M2 } from "@/model"; export const helper = () => {};',
    });
    const summary = buildGraph(vfs.getAllFiles(), vfs.srcDir, vfs);
    expect(summary.relativeEdges).toBe(1); // model -> helper is runtime
    expect(summary.aliasEdges).toBe(0); // helper -> model is type-only
    const cycles = findCycles(summary.graph, vfs.srcDir);
    expect(cycles).toEqual([]); // No false cycle reported
  });

  it("9. unresolved internal TypeScript imports are not silently ignored", () => {
    const vfs = createVirtualFs({
      "broken.ts": 'import { ghost } from "./nonExistent"; import { phantom } from "@/nowhere";',
    });
    const summary = buildGraph(vfs.getAllFiles(), vfs.srcDir, vfs);
    expect(summary.unresolved).toHaveLength(2);
    expect(summary.unresolved.map((u) => u.spec)).toEqual(["./nonExistent", "@/nowhere"]);
  });
});

/**
 * The engine has NO circular imports. It got there by giving each shared thing
 * an owner below the engine rather than reaching back up into it: the anatomy
 * flag lives with the profiles, the perio display settings and the numbering
 * notation have their own modules, and the tooth-state predicates sit with the
 * payload contract. The places that genuinely must call INTO the engine use
 * an injected hook (setPostNotifyHook, setPluginIdsProvider, setToothEditGate).
 *
 * Keep it at zero: a cycle means a module can read a partially initialized
 * import and get `undefined` at module-eval time, often only in the built
 * bundle, not in tests.
 */
describe("module graph (production src/)", () => {
  let summary: GraphSummary;

  beforeAll(() => {
    const files = sourceFiles(SRC);
    summary = buildGraph(files);
  });

  it("has no circular imports in src/", () => {
    // Verify comprehensive module discovery across src/
    expect(summary.graph.size).toBeGreaterThanOrEqual(180);
    expect(summary.relativeEdges).toBeGreaterThan(200);
    expect(summary.aliasEdges).toBeGreaterThan(300);

    // Ensure all internal relative and alias imports resolve cleanly
    expect(summary.unresolved).toEqual([]);

    // Ensure no circular dependency cycles exist
    const found = [...new Set(findCycles(summary.graph).map((c) => c.join(" -> ")))].sort();
    expect(found).toEqual([]);
  });

  it("the modules extracted from odontogram.ts never import it back", () => {
    const engine = path.join(SRC, "odontogram.ts");
    for (const mod of [
      "state/notify.ts",
      "state/caseMeta.ts",
      "state/payload.ts",
      "state/chart.ts",
      "anatomy/profiles.ts",
      "engine/overlays/bridgeOverlayManager.ts",
      "engine/indicators/surfaceIndicators.ts",
      "engine/indicators/clinicalVisibility.ts",
      "engine/controls/controlPresentation.ts",
      "engine/popups/surfacePopups.ts",
      "engine/gestures/touchGestures.ts",
      "engine/navigation/tileNavigation.ts",
      "engine/overlays/pluginOverlayRenderer.ts",
      "engine/overlays/tileOverlays.ts",
      "engine/rendering/toothSvgPainter.ts",
      "engine/controls/perioGridController.ts",
      "engine/presets/clinicalPresetCalculators.ts",
    ]) {
      const file = path.join(SRC, mod);
      expect(existsSync(file), `${mod} is missing`).toBe(true);
      expect(summary.graph.get(file), `${mod} imports odontogram.ts — use an injected hook instead`).not.toContain(engine);
    }
  });
});
