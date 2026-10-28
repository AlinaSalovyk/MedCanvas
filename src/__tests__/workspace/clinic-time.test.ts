import { describe, expect, it } from "vitest";
import { clinicDate, clinicLocalToUtc } from "../../workspace/clinicTime";

describe("clinic time independent of browser zone", () => {
  it.each([
    ["2026-11-02T10:00", "2026-11-02T08:00:00.000Z"],
    ["2026-07-02T10:00", "2026-07-02T07:00:00.000Z"],
  ])("resolves %s in Europe/Kyiv", (local, utc) => {
    expect(clinicLocalToUtc(local, "Europe/Kyiv").toISOString()).toBe(utc);
  });
  it.each(["2026-03-29T03:30", "2026-10-25T03:30", "2026-02-30T10:00", "invalid"])("rejects ambiguous, nonexistent or invalid wall time %s", local => {
    expect(() => clinicLocalToUtc(local, "Europe/Kyiv")).toThrow();
  });
  it("groups appointments by the clinic's date at the UTC boundary", () => {
    expect(clinicDate(new Date("2026-11-02T22:30:00Z"), "Europe/Kyiv")).toBe("2026-11-03");
  });
});
