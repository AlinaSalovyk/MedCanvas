import { useEffect, useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, Link, RouterProvider } from "react-router-dom";
import { EncounterNavigationGuard, registerEncounterFlush } from "../../workspace/encounterNavigation";
import { emptyClinicalSnapshot } from "../../workspace/emptyClinicalSnapshot";

describe("save before leaving the clinical encounter", () => {
  it("retains the route after a failed save, then proceeds after a confirmed retry", async () => {
    let dirty = true;
    const save = vi.fn().mockRejectedValueOnce(new Error("network unavailable")).mockImplementationOnce(async () => { dirty = false; });
    function Editor() {
      const [error, setError] = useState("");
      useEffect(() => registerEncounterFlush(save), []);
      return <><EncounterNavigationGuard hasChanges={() => dirty} onError={setError} />
        <Link to="/patients">Patients</Link><p role="alert">{error}</p></>;
    }
    const router = createMemoryRouter([{ path: "/", element: <Editor /> }, { path: "/patients", element: <h1>Patients list</h1> }]);
    render(<RouterProvider router={router} />);
    fireEvent.click(screen.getByRole("link", { name: "Patients" }));
    await screen.findByText("network unavailable");
    expect(router.state.location.pathname).toBe("/");
    expect(dirty).toBe(true);
    fireEvent.click(screen.getByRole("link", { name: "Patients" }));
    await screen.findByRole("heading", { name: "Patients list" });
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(router.state.location.pathname).toBe("/patients");
  });

  it("builds a new canonical chart without previous patient metadata or plan state", () => {
    const snapshot = JSON.parse(emptyClinicalSnapshot()) as { teeth: Record<string, { caries: unknown[] }>; case?: unknown; plan?: unknown };
    expect(Object.keys(snapshot.teeth)).toHaveLength(32);
    expect(snapshot.case).toBeUndefined();
    expect(snapshot.plan).toBeUndefined();
    expect(Object.values(snapshot.teeth).every(tooth => tooth.caries.length === 0)).toBe(true);
  });
});
