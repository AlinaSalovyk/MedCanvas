import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { buildSyntheticFixtures, writeCanonicalFixtures, FIXTURES_DIR } from "./canonical-fixtures";

describe("Canonical Frontend-Generated Fixtures & Drift Detection", () => {
  it("generates deterministic synthetic fixtures without error", () => {
    const fixtures = buildSyntheticFixtures();
    expect(Object.keys(fixtures)).toHaveLength(9);
    for (const [filename, content] of Object.entries(fixtures)) {
      expect(filename).toMatch(/\.json$/);
      expect((content as { version: string }).version).toBe("2.22");
    }
  });

  it("verifies checked-in generated fixtures match actual frontend serialization byte-for-byte (drift check)", () => {
    // If running in generate mode or if fixtures directory does not exist, write them
    if (process.env.CANONICAL_FIXTURES_WRITE || !fs.existsSync(FIXTURES_DIR)) {
      writeCanonicalFixtures();
    }

    const fixtures = buildSyntheticFixtures();
    for (const [filename, data] of Object.entries(fixtures)) {
      const filePath = path.join(FIXTURES_DIR, filename);
      expect(fs.existsSync(filePath), `Fixture file ${filename} must exist`).toBe(true);
      const onDisk = fs.readFileSync(filePath, "utf-8");
      const expected = JSON.stringify(data, null, 2) + "\n";
      expect(onDisk).toBe(expected);
    }
  });
});
