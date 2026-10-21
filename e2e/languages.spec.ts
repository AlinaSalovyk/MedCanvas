// UI languages in a real build: English (bundled statically) and Ukrainian (lazy loaded).
import { test, expect } from "@playwright/test";
import { chooseLanguage, openChart, sideTiles } from "./helpers";

const UK_CHUNK = /\/assets\/uk-[\w-]+\.js$/;

test("only English is bundled at start; Ukrainian chunk is fetched when selected", async ({ page }) => {
  const fetched: string[] = [];
  page.on("request", (req) => {
    const pathname = new URL(req.url()).pathname;
    if (UK_CHUNK.test(pathname)) fetched.push("uk");
  });

  await openChart(page);
  expect(fetched, "Ukrainian chunk was fetched before anyone asked for it").toEqual([]);
  await expect(page.locator(".odontogram-root")).toHaveAttribute("lang", "en");
  await expect(page.locator(".topbar .subtitle")).toContainText("In English.");

  await chooseLanguage(page, /Ukrainian|Українська/i);
  await expect(page.locator(".odontogram-root")).toHaveAttribute("lang", "uk");
  await expect(page.locator(".topbar .subtitle")).toContainText("Українською мовою.");
  expect(fetched).toEqual(["uk"]);
});

test("a switch keeps the current language on screen until the Ukrainian chunk arrives", async ({ page }) => {
  await openChart(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(UK_CHUNK, async (route) => {
    await held;
    await route.continue();
  });

  await chooseLanguage(page, /Ukrainian|Українська/i);
  // While Ukrainian is still downloading, UI must remain in English
  await expect(page.locator(".odontogram-root")).toHaveAttribute("lang", "en");
  await expect(page.locator(".topbar .subtitle")).toContainText("In English.");

  release();
  await expect(page.locator(".odontogram-root")).toHaveAttribute("lang", "uk");
  await expect(page.locator(".topbar .subtitle")).toContainText("Українською мовою.");
});

test("dental chart geometry remains left-to-right in both English and Ukrainian", async ({ page }) => {
  await openChart(page);
  const root = page.locator(".odontogram-root");
  await expect(root).toHaveAttribute("dir", "ltr");
  expect(await page.locator("#toothGrid").evaluate((el) => getComputedStyle(el).direction)).toBe("ltr");
  const [t18, t28] = await sideTiles(page, [18, 28]);
  expect(t18.x, "18 must be on the left").toBeLessThan(t28.x);

  await chooseLanguage(page, /Ukrainian|Українська/i);
  await expect(root).toHaveAttribute("dir", "ltr");
  expect(await page.locator("#toothGrid").evaluate((el) => getComputedStyle(el).direction)).toBe("ltr");
  const [t18Uk, t28Uk] = await sideTiles(page, [18, 28]);
  expect(t18Uk.x, "18 must remain on the left in Ukrainian").toBeLessThan(t28Uk.x);
});
