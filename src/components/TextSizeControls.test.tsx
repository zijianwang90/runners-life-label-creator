import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import type { TextScales } from "../types";
import { TextSizeControls } from "./TextSizeControls";

afterEach(cleanup);

const DEFAULTS: TextScales = { modelTextScale: 1, featureTextScale: 1, priceTextScale: 1 };

function Harness({ initial = {}, heightMm = 23 }: { initial?: Partial<TextScales>; heightMm?: number }) {
  const [scales, setScales] = useState<TextScales>({ ...DEFAULTS, ...initial });
  return <TextSizeControls scales={scales} heightMm={heightMm} onChange={(patch) => setScales((current) => ({ ...current, ...patch }))} />;
}

const field = (name: string) => screen.getByLabelText(name) as HTMLInputElement;
const reset = () => screen.getByRole("button", { name: /reset all to 100%/i }) as HTMLButtonElement;

describe("label text size controls", () => {
  it("starts every text at the approved size and says how large each prints", () => {
    render(<Harness />);
    expect(field("Model name text size slider").value).toBe("100");
    expect(field("Selling point text size slider").value).toBe("100");
    expect(field("Price text size slider").value).toBe("100");
    expect(screen.getByText("≈ 6.0 pt")).toBeTruthy(); // selling points
    expect(screen.getByText("≈ 16.4 pt")).toBeTruthy(); // model name
    expect(screen.getByText("≈ 24.9 pt")).toBeTruthy(); // price
    expect(reset().disabled).toBe(true);
  });

  it("changes one text without touching the others", () => {
    render(<Harness />);
    fireEvent.change(field("Model name text size slider"), { target: { value: "130" } });
    expect(field("Model name text size in percent").value).toBe("130");
    expect(field("Selling point text size slider").value).toBe("100");
    expect(field("Price text size slider").value).toBe("100");
    expect(screen.getByText("≈ 21.4 pt")).toBeTruthy();
    expect(reset().disabled).toBe(false);
  });

  it("takes the label height into account", () => {
    render(<Harness initial={{ featureTextScale: 1.5 }} heightMm={30} />);
    expect(screen.getByText(/30 mm tall/)).toBeTruthy();
    expect(screen.getByText("≈ 11.6 pt")).toBeTruthy();
  });

  it("jumps to a quick size and offers only sizes the text can take", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("group", { name: "Selling point quick sizes" }).querySelector("button:nth-child(3)")!);
    expect(field("Selling point text size slider").value).toBe("130");
    const priceSizes = [...screen.getByRole("group", { name: "Price quick sizes" }).querySelectorAll("button")].map((button) => button.textContent);
    expect(priceSizes).toEqual(["100%", "115%"]);
  });

  it("clamps a typed number to each text's own range when leaving the field", () => {
    render(<Harness />);
    fireEvent.change(field("Selling point text size in percent"), { target: { value: "140" } });
    expect(field("Selling point text size slider").value).toBe("140");

    fireEvent.change(field("Selling point text size in percent"), { target: { value: "999" } });
    fireEvent.blur(field("Selling point text size in percent"));
    expect(field("Selling point text size in percent").value).toBe("170");

    fireEvent.change(field("Model name text size in percent"), { target: { value: "999" } });
    fireEvent.blur(field("Model name text size in percent"));
    expect(field("Model name text size in percent").value).toBe("140");

    fireEvent.change(field("Price text size in percent"), { target: { value: "10" } });
    fireEvent.blur(field("Price text size in percent"));
    expect(field("Price text size in percent").value).toBe("80");
  });

  it("shows the approved size when it is given no usable value", () => {
    render(<TextSizeControls scales={{ modelTextScale: Number.NaN, featureTextScale: undefined as unknown as number, priceTextScale: 0 }} heightMm={23} onChange={() => undefined} />);
    expect(field("Model name text size slider").value).toBe("100");
    expect(field("Selling point text size in percent").value).toBe("100");
    expect(field("Price text size slider").value).toBe("100");
  });

  it("puts every text back to the approved size on reset", () => {
    render(<Harness initial={{ modelTextScale: 1.2, featureTextScale: 1.4, priceTextScale: 1.1 }} />);
    fireEvent.click(reset());
    expect(field("Model name text size slider").value).toBe("100");
    expect(field("Selling point text size slider").value).toBe("100");
    expect(field("Price text size slider").value).toBe("100");
  });
});
