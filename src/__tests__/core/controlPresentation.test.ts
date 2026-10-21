import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  loadInlineIcon,
  syncIconXLine,
  getControlLabel,
  syncControlLabelVisibility,
  setDisabled,
  setToggleButton,
  getToggleLabel,
  applyToggleA11y,
} from "@/engine/controls/controlPresentation";
import { setI18nLanguage, t } from "@/i18n/useI18n";

describe("controlPresentation module", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    setI18nLanguage("en");
  });

  afterEach(() => {
    document.body.innerHTML = "";
    setI18nLanguage("en");
  });

  describe("loadInlineIcon", () => {
    it("parses valid inline SVG from button dataset, removes width/height, and appends with icon-svg class", async () => {
      const btn = document.createElement("button");
      btn.dataset.iconSrc = '<svg width="24" height="24" viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>';
      btn.innerHTML = "<span>fallback</span>";

      await loadInlineIcon(btn);

      const svg = btn.querySelector("svg");
      expect(svg).not.toBeNull();
      expect(svg?.hasAttribute("width")).toBe(false);
      expect(svg?.hasAttribute("height")).toBe(false);
      expect(svg?.classList.contains("icon-svg")).toBe(true);
      expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24");
      // The original innerHTML was cleared and replaced with the SVG element
      expect(btn.querySelector("span")).toBeNull();
      expect(btn.children.length).toBe(1);
    });

    it("does nothing if button is null or undefined", async () => {
      await expect(loadInlineIcon(null)).resolves.toBeUndefined();
      await expect(loadInlineIcon(undefined)).resolves.toBeUndefined();
    });

    it("does nothing if button has no iconSrc in dataset", async () => {
      const btn = document.createElement("button");
      btn.innerHTML = "Original text";

      await loadInlineIcon(btn);

      expect(btn.innerHTML).toBe("Original text");
    });

    it("silently catches and ignores parse errors for invalid SVG markup", async () => {
      const btn = document.createElement("button");
      btn.dataset.iconSrc = "<<not valid xml>>";
      btn.innerHTML = "<span>Untouched</span>";

      // Even if parser produces a parsererror document or throws, it does not throw
      await expect(loadInlineIcon(btn)).resolves.toBeUndefined();
    });

    it("repeated calls replace previous icon cleanly", async () => {
      const btn = document.createElement("button");
      btn.dataset.iconSrc = '<svg width="10" height="10" id="icon1"></svg>';
      await loadInlineIcon(btn);
      expect(btn.querySelector("svg#icon1")).not.toBeNull();

      btn.dataset.iconSrc = '<svg width="20" height="20" id="icon2"></svg>';
      await loadInlineIcon(btn);
      expect(btn.querySelector("svg#icon1")).toBeNull();
      expect(btn.querySelector("svg#icon2")).not.toBeNull();
      expect(btn.children.length).toBe(1);
    });
  });

  describe("syncIconXLine", () => {
    it("does nothing if button has no data-xline attribute", () => {
      const btn = document.createElement("button");
      btn.innerHTML = '<svg><line id="x-line" style="display: block;"></line></svg>';
      btn.setAttribute("aria-pressed", "true");

      syncIconXLine(btn);

      const line = btn.querySelector("#x-line") as HTMLElement;
      expect(line.style.display).toBe("block");
    });

    it("does nothing if button is null or undefined", () => {
      expect(() => syncIconXLine(null)).not.toThrow();
      expect(() => syncIconXLine(undefined)).not.toThrow();
    });

    it("hides #x-line when aria-pressed is 'true' on button with data-xline", () => {
      const btn = document.createElement("button");
      btn.dataset.xline = "1";
      btn.setAttribute("aria-pressed", "true");
      btn.innerHTML = '<svg><line id="x-line"></line></svg>';

      syncIconXLine(btn);

      const line = btn.querySelector("#x-line") as HTMLElement;
      expect(line.style.display).toBe("none");
    });

    it("shows #x-line (resets display to empty) when aria-pressed is 'false' on button with data-xline", () => {
      const btn = document.createElement("button");
      btn.dataset.xline = "1";
      btn.setAttribute("aria-pressed", "false");
      btn.innerHTML = '<svg><line id="x-line" style="display: none;"></line></svg>';

      syncIconXLine(btn);

      const line = btn.querySelector("#x-line") as HTMLElement;
      expect(line.style.display).toBe("");
    });

    it("handles button with data-xline but without #x-line gracefully", () => {
      const btn = document.createElement("button");
      btn.dataset.xline = "1";
      btn.setAttribute("aria-pressed", "true");

      expect(() => syncIconXLine(btn)).not.toThrow();
    });
  });

  describe("getControlLabel", () => {
    it("returns closest wrapping <label> element when control is inside label", () => {
      const label = document.createElement("label");
      const input = document.createElement("input");
      label.appendChild(input);
      document.body.appendChild(label);

      const found = getControlLabel(input);
      expect(found).toBe(label);
    });

    it("returns label[for=id] element when control has id and matching label exists in document", () => {
      const label = document.createElement("label");
      label.setAttribute("for", "my-control-id");
      const input = document.createElement("input");
      input.id = "my-control-id";
      document.body.appendChild(label);
      document.body.appendChild(input);

      const found = getControlLabel(input);
      expect(found).toBe(label);
    });

    it("returns null when control has an id but no matching label[for=id] exists", () => {
      const input = document.createElement("input");
      input.id = "orphaned-control";
      document.body.appendChild(input);

      const found = getControlLabel(input);
      expect(found).toBeNull();
    });

    it("returns null when control has no id and is not wrapped in a label", () => {
      const input = document.createElement("input");
      document.body.appendChild(input);

      const found = getControlLabel(input);
      expect(found).toBeNull();
    });

    it("returns null for null or undefined control", () => {
      expect(getControlLabel(null)).toBeNull();
      expect(getControlLabel(undefined)).toBeNull();
    });
  });

  describe("syncControlLabelVisibility", () => {
    it("sets label display to 'none' when control is disabled", () => {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.disabled = true;
      label.appendChild(input);
      document.body.appendChild(label);

      syncControlLabelVisibility(input);

      expect(label.style.display).toBe("none");
    });

    it("sets label display to '' when control is enabled", () => {
      const label = document.createElement("label");
      label.style.display = "none";
      const input = document.createElement("input");
      input.disabled = false;
      label.appendChild(input);
      document.body.appendChild(label);

      syncControlLabelVisibility(input);

      expect(label.style.display).toBe("");
    });

    it("does nothing and does not throw when control has no associated label", () => {
      const input = document.createElement("input");
      input.disabled = true;

      expect(() => syncControlLabelVisibility(input)).not.toThrow();
    });
  });

  describe("setDisabled", () => {
    it("sets control.disabled to true and hides associated label", () => {
      const label = document.createElement("label");
      const input = document.createElement("input");
      label.appendChild(input);
      document.body.appendChild(label);

      setDisabled(input, true);

      expect(input.disabled).toBe(true);
      expect(label.style.display).toBe("none");
    });

    it("sets control.disabled to false and restores associated label visibility", () => {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.disabled = true;
      label.style.display = "none";
      label.appendChild(input);
      document.body.appendChild(label);

      setDisabled(input, false);

      expect(input.disabled).toBe(false);
      expect(label.style.display).toBe("");
    });

    it("correctly coerces truthy and falsy values via !!disabled", () => {
      const input = document.createElement("input");
      setDisabled(input, 1);
      expect(input.disabled).toBe(true);

      setDisabled(input, 0);
      expect(input.disabled).toBe(false);

      setDisabled(input, "truthy");
      expect(input.disabled).toBe(true);

      setDisabled(input, null);
      expect(input.disabled).toBe(false);

      setDisabled(input, undefined);
      expect(input.disabled).toBe(false);
    });

    it("does nothing and does not throw when control is null", () => {
      expect(() => setDisabled(null, true)).not.toThrow();
      expect(() => setDisabled(undefined, false)).not.toThrow();
    });

    it("repeated sequential toggling correctly maintains consistent state", () => {
      const label = document.createElement("label");
      const input = document.createElement("input");
      label.appendChild(input);
      document.body.appendChild(label);

      setDisabled(input, true);
      expect(input.disabled).toBe(true);
      expect(label.style.display).toBe("none");

      setDisabled(input, false);
      expect(input.disabled).toBe(false);
      expect(label.style.display).toBe("");

      setDisabled(input, true);
      expect(input.disabled).toBe(true);
      expect(label.style.display).toBe("none");
    });
  });

  describe("setToggleButton", () => {
    it("sets aria-pressed to 'true' and syncs icon x-line (display: none)", () => {
      const btn = document.createElement("button");
      btn.dataset.xline = "1";
      btn.innerHTML = '<svg><line id="x-line"></line></svg>';

      setToggleButton(btn, true);

      expect(btn.getAttribute("aria-pressed")).toBe("true");
      const line = btn.querySelector("#x-line") as HTMLElement;
      expect(line.style.display).toBe("none");
    });

    it("sets aria-pressed to 'false' and syncs icon x-line (display: '')", () => {
      const btn = document.createElement("button");
      btn.dataset.xline = "1";
      btn.setAttribute("aria-pressed", "true");
      btn.innerHTML = '<svg><line id="x-line" style="display: none;"></line></svg>';

      setToggleButton(btn, false);

      expect(btn.getAttribute("aria-pressed")).toBe("false");
      const line = btn.querySelector("#x-line") as HTMLElement;
      expect(line.style.display).toBe("");
    });

    it("handles truthy/falsy arguments for on parameter", () => {
      const btn = document.createElement("button");
      setToggleButton(btn, 1);
      expect(btn.getAttribute("aria-pressed")).toBe("true");

      setToggleButton(btn, 0);
      expect(btn.getAttribute("aria-pressed")).toBe("false");

      setToggleButton(btn, "yes");
      expect(btn.getAttribute("aria-pressed")).toBe("true");

      setToggleButton(btn, null);
      expect(btn.getAttribute("aria-pressed")).toBe("false");
    });

    it("does nothing and does not throw when btn is null or undefined", () => {
      expect(() => setToggleButton(null, true)).not.toThrow();
      expect(() => setToggleButton(undefined, false)).not.toThrow();
    });
  });

  describe("getToggleLabel", () => {
    it("returns expand text with localized label when collapsed is true", () => {
      setI18nLanguage("en");
      const text = getToggleLabel("status.title", true);
      const expected = t("actions.expand", { label: t("status.title") });
      expect(text).toBe(expected);
      expect(text.toLowerCase()).toContain("open");
    });

    it("returns collapse text with localized label when collapsed is false", () => {
      setI18nLanguage("en");
      const text = getToggleLabel("status.title", false);
      const expected = t("actions.collapse", { label: t("status.title") });
      expect(text).toBe(expected);
      expect(text.toLowerCase()).toContain("collapse");
    });

    it("dynamically reflects language switching without stale caching", () => {
      setI18nLanguage("en");
      const enText = getToggleLabel("panel.controls", true);

      setI18nLanguage("uk");
      const ukText = getToggleLabel("panel.controls", true);

      expect(enText).not.toBe(ukText);
      expect(ukText).toBe(t("actions.expand", { label: t("panel.controls") }));
    });
  });

  describe("applyToggleA11y", () => {
    it("sets title and aria-label to expand label when collapsed is true", () => {
      const btn = document.createElement("button");
      setI18nLanguage("en");

      applyToggleA11y(btn, "card.rootPeriodontium", true);

      const expected = getToggleLabel("card.rootPeriodontium", true);
      expect(btn.getAttribute("title")).toBe(expected);
      expect(btn.getAttribute("aria-label")).toBe(expected);
    });

    it("sets title and aria-label to collapse label when collapsed is false", () => {
      const btn = document.createElement("button");
      setI18nLanguage("en");

      applyToggleA11y(btn, "card.rootPeriodontium", false);

      const expected = getToggleLabel("card.rootPeriodontium", false);
      expect(btn.getAttribute("title")).toBe(expected);
      expect(btn.getAttribute("aria-label")).toBe(expected);
    });

    it("does nothing and does not throw if btn is null or undefined", () => {
      expect(() => applyToggleA11y(null, "status.title", true)).not.toThrow();
      expect(() => applyToggleA11y(undefined, "status.title", false)).not.toThrow();
    });

    it("repeated calls update accessibility labels seamlessly upon state change", () => {
      const btn = document.createElement("button");

      applyToggleA11y(btn, "status.title", true);
      expect(btn.getAttribute("aria-label")).toBe(getToggleLabel("status.title", true));

      applyToggleA11y(btn, "status.title", false);
      expect(btn.getAttribute("aria-label")).toBe(getToggleLabel("status.title", false));
    });
  });
});
