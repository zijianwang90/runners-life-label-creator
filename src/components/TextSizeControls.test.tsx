import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { defaultSettings } from "../data";
import type { TextScales } from "../types";
import { TextSizeControls } from "./TextSizeControls";

afterEach(cleanup);

const DEFAULTS: TextScales = {
  modelTextScale: defaultSettings.modelTextScale,
  featureTextScale: defaultSettings.featureTextScale,
  priceTextScale: defaultSettings.priceTextScale,
  regularPriceTextScale: defaultSettings.regularPriceTextScale,
  saleSealScale: defaultSettings.saleSealScale
};

function Harness({ initial = {}, heightMm = 23 }: { initial?: Partial<TextScales>; heightMm?: number }) {
  const [scales, setScales] = useState<TextScales>({ ...DEFAULTS, ...initial });
  return <TextSizeControls scales={scales} heightMm={heightMm} onChange={(patch) => setScales((current) => ({ ...current, ...patch }))} />;
}

const field = (name: string) => screen.getByLabelText(name) as HTMLInputElement;
const reset = () => screen.getByRole("button", { name: /reset all to 100%/i }) as HTMLButtonElement;
const NAMES = ["Model name", "Selling point", "Price", "Sale regular price", "Sale seal"];

describe("label text size controls", () => {
  it("shows the shop standard as 100% for everything and says how large each prints", () => {
    render(<Harness />);
    for (const name of NAMES) expect(field(`${name} text size slider`).value).toBe("100");
    expect(screen.getByText("≈ 21.4 pt")).toBeTruthy(); // model name
    expect(screen.getByText("≈ 8.9 pt")).toBeTruthy(); // selling points
    expect(screen.getByText("≈ 29.9 pt")).toBeTruthy(); // price
    expect(screen.getByText("≈ 7.7 pt")).toBeTruthy(); // sale regular price
    expect(screen.getByText("⌀ 14.4 mm")).toBeTruthy(); // seal
    expect(reset().disabled).toBe(true);
  });

  it("shows sizes saved relative to the approved design as a percent of the shop standard", () => {
    render(<Harness initial={{ modelTextScale: 1, featureTextScale: 1 }} />);
    expect(field("Model name text size in percent").value).toBe("77");
    expect(field("Selling point text size in percent").value).toBe("67");
  });

  it("changes one size without touching the others", () => {
    render(<Harness />);
    fireEvent.change(field("Model name text size slider"), { target: { value: "130" } });
    expect(field("Model name text size in percent").value).toBe("130");
    expect(screen.getByText("≈ 27.8 pt")).toBeTruthy();
    for (const name of NAMES.slice(1)) expect(field(`${name} text size slider`).value).toBe("100");
    expect(reset().disabled).toBe(false);
  });

  it("takes the label height into account", () => {
    render(<Harness heightMm={30} />);
    expect(screen.getByText(/30 mm tall/)).toBeTruthy();
    expect(screen.getByText("≈ 11.6 pt")).toBeTruthy();
  });

  it("jumps to a quick size and offers only sizes in range", () => {
    render(<Harness />);
    fireEvent.click(within(screen.getByRole("group", { name: "Selling point quick sizes" })).getByRole("button", { name: "115%" }));
    expect(field("Selling point text size slider").value).toBe("115");
    const sizes = (name: string) => within(screen.getByRole("group", { name: `${name} quick sizes` })).getAllByRole("button").map((button) => button.textContent);
    expect(sizes("Model name")).toEqual(["80%", "90%", "100%", "115%", "130%"]);
    expect(sizes("Price")).toEqual(["80%", "90%", "100%", "115%"]);
    expect(sizes("Sale seal")).toEqual(["80%", "90%", "100%", "115%"]);
  });

  it("clamps a typed number to each size's own range when leaving the field", () => {
    render(<Harness />);
    fireEvent.change(field("Selling point text size in percent"), { target: { value: "120" } });
    expect(field("Selling point text size slider").value).toBe("120");

    fireEvent.change(field("Selling point text size in percent"), { target: { value: "999" } });
    fireEvent.blur(field("Selling point text size in percent"));
    expect(field("Selling point text size in percent").value).toBe("130");

    fireEvent.change(field("Price text size in percent"), { target: { value: "10" } });
    fireEvent.blur(field("Price text size in percent"));
    expect(field("Price text size in percent").value).toBe("70");

    fireEvent.change(field("Sale seal text size in percent"), { target: { value: "500" } });
    fireEvent.blur(field("Sale seal text size in percent"));
    expect(field("Sale seal text size in percent").value).toBe("120");
  });

  it("shows the shop standard when it is given no usable value", () => {
    const broken = { modelTextScale: Number.NaN, featureTextScale: undefined, priceTextScale: 0, regularPriceTextScale: -1, saleSealScale: Number.NaN } as unknown as TextScales;
    render(<TextSizeControls scales={broken} heightMm={23} onChange={() => undefined} />);
    for (const name of NAMES) expect(field(`${name} text size slider`).value).toBe("100");
  });

  it("puts every size back to the shop standard on reset", () => {
    render(<Harness initial={{ modelTextScale: 1.6, featureTextScale: 1.1, priceTextScale: 0.9, regularPriceTextScale: 1.9, saleSealScale: 1.2 }} />);
    fireEvent.click(reset());
    for (const name of NAMES) expect(field(`${name} text size slider`).value).toBe("100");
  });
});
