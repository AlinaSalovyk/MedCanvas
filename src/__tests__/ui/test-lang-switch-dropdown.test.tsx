import { describe, it, expect, beforeEach } from "vitest";
import { createElement } from "react";
import { render, cleanup, act } from "@testing-library/react";
import ToothDetailsCard from "../../surfaces/cards/ToothDetailsCard";
import FillingsCard from "../../surfaces/cards/FillingsCard";
import { OdontogramProvider, useOdontogramUi } from "../../OdontogramContext";
import { setI18nLanguage } from "../../i18n/useI18n";

function LanguageSwitcherTest() {
  const { lang, setLang } = useOdontogramUi();
  return (
    <div>
      <button id="btnSwitchToUk" onClick={() => setLang("uk")}>Switch to UK</button>
      <span id="currentLang">{lang}</span>
      <ToothDetailsCard />
      <FillingsCard />
    </div>
  );
}

describe("Language switch reactivity on dropdown options", () => {
  beforeEach(async () => {
    cleanup();
    await setI18nLanguage("en");
  });

  it("updates option labels from English to Ukrainian on language switch", async () => {
    const { container } = render(
      createElement(OdontogramProvider, null,
        createElement(LanguageSwitcherTest)
      )
    );

    const toothSelect = container.querySelector("#toothSelect") as HTMLSelectElement;
    expect(toothSelect).toBeTruthy();
    let permanentOption = Array.from(toothSelect.options).find(o => o.value === "tooth-base");
    expect(permanentOption?.textContent).toBe("Permanent tooth");

    const substrateSelect = container.querySelector("#substrateSelect") as HTMLSelectElement;
    expect(substrateSelect).toBeTruthy();
    let naturalOption = Array.from(substrateSelect.options).find(o => o.value === "natural");
    expect(naturalOption?.textContent).toBe("Sound");

    const restorationSelect = container.querySelector("#restorationSelect") as HTMLSelectElement;
    expect(restorationSelect).toBeTruthy();
    let restoNoneOption = Array.from(restorationSelect.options).find(o => o.value === "none|none" || o.value === "none");
    expect(restoNoneOption?.textContent).toBe("None");

    const fillingSelect = container.querySelector("#fillingSelect") as HTMLSelectElement;
    expect(fillingSelect).toBeTruthy();
    let fillingNoneOption = Array.from(fillingSelect.options).find(o => o.value === "none");
    expect(fillingNoneOption?.textContent).toBe("No filling");

    const switchBtn = container.querySelector("#btnSwitchToUk") as HTMLButtonElement;
    await act(async () => {
      switchBtn.click();
      // Allow async chunk loading
      await new Promise(r => setTimeout(r, 100));
    });

    permanentOption = Array.from(toothSelect.options).find(o => o.value === "tooth-base");
    expect(permanentOption?.textContent).toBe("Постійний зуб");

    naturalOption = Array.from(substrateSelect.options).find(o => o.value === "natural");
    expect(naturalOption?.textContent).toBe("Здоровий / інтактний");

    restoNoneOption = Array.from(restorationSelect.options).find(o => o.value === "none|none" || o.value === "none");
    expect(restoNoneOption?.textContent).toBe("Немає");

    fillingNoneOption = Array.from(fillingSelect.options).find(o => o.value === "none");
    expect(fillingNoneOption?.textContent).toBe("Без пломби");
  });
});
