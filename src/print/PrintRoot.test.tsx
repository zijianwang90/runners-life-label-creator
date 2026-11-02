import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultSettings } from "../data";
import type { PrintPayload, ShoeLabel } from "../types";
import { PrintRoot } from "./PrintRoot";

const shoe = (id: string, quantity = 1): ShoeLabel => ({
  id,
  brand: "saucony",
  model: `Model ${id}`,
  regularPrice: 199.99,
  salePrice: null,
  features: ["Race day", "8mm drop", "Carbon plate"],
  summary: "",
  specs: { heelStackMm: null, forefootStackMm: null, weightG: null, plate: "" },
  quantity,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
});

function renderJob(patch: Partial<PrintPayload>) {
  const payload: PrintPayload = {
    kind: "labels",
    labels: [shoe("a", 13)],
    mode: "a4",
    paperSize: "a4",
    currencySymbol: "$",
    labelSize: { ...defaultSettings.labelSize },
    modelTextScale: defaultSettings.modelTextScale,
    featureTextScale: defaultSettings.featureTextScale,
    priceTextScale: defaultSettings.priceTextScale,
    regularPriceTextScale: defaultSettings.regularPriceTextScale,
    saleSealScale: defaultSettings.saleSealScale,
    calibration: defaultSettings.calibration,
    ...patch
  };
  const notifyPrintReady = vi.fn();
  window.electronAPI = {
    onPrintPayload: (callback: (jobId: string, payload: PrintPayload) => void) => { callback("job-1", payload); return () => undefined; },
    notifyPrintReady
  } as unknown as typeof window.electronAPI;
  return render(<PrintRoot />);
}

afterEach(() => { window.electronAPI = undefined; });

describe("print document at other label sizes", () => {
  it("keeps the approved sheet at 220 × 23 mm: eight labels per A4 page, centred", () => {
    const { container } = renderJob({});
    const pages = container.querySelectorAll(".a4-print-page");
    expect([...pages].map((page) => page.querySelectorAll(".a4-label-slot").length)).toEqual([8, 5]);
    const stack = pages[0].querySelector<HTMLElement>(".a4-label-stack")!;
    expect(stack.style.left).toBe("38.5mm");
    expect(stack.style.top).toBe("13mm");
    expect(stack.style.height).toBe("184mm");
    expect(container.querySelector<HTMLElement>(".print-document")!.style.getPropertyValue("--label-w")).toBe("220mm");
  });

  it("fits fewer, larger labels per sheet and re-centres them", () => {
    const { container } = renderJob({ labelSize: { widthMm: 240, heightMm: 28 } });
    const pages = container.querySelectorAll(".a4-print-page");
    expect([...pages].map((page) => page.querySelectorAll(".a4-label-slot").length)).toEqual([6, 6, 1]);
    const stack = pages[0].querySelector<HTMLElement>(".a4-label-stack")!;
    expect(stack.style.left).toBe("28.5mm");
    expect(stack.style.top).toBe("21mm");
    const root = container.querySelector<HTMLElement>(".print-document")!;
    expect(root.style.getPropertyValue("--label-w")).toBe("240mm");
    expect(root.style.getPropertyValue("--label-h")).toBe("28mm");
  });

  it("prints 180 × 30 mm on portrait sheets of eight", () => {
    const { container } = renderJob({ labelSize: { widthMm: 180, heightMm: 30 } });
    const pages = container.querySelectorAll(".a4-print-page");
    expect([...pages].map((page) => page.querySelectorAll(".a4-label-slot").length)).toEqual([8, 5]);
    const stack = pages[0].querySelector<HTMLElement>(".a4-label-stack")!;
    expect(stack.style.left).toBe("15mm");
    expect(stack.style.top).toBe("28.5mm");
    expect(container.querySelector("style")!.textContent).toContain("size: A4 portrait");
    expect(container.querySelector<HTMLElement>(".print-document")!.style.getPropertyValue("--page-w")).toBe("210mm");
  });

  it("prints on Letter when that is the paper: landscape for 220 × 23 mm, portrait for 180 × 30 mm", () => {
    const wide = renderJob({ paperSize: "letter" });
    expect(wide.container.querySelector("style")!.textContent).toContain("size: Letter landscape");
    expect(wide.container.querySelector<HTMLElement>(".a4-label-stack")!.style.left).toBe("29.7mm");
    wide.unmount();
    const narrow = renderJob({ paperSize: "letter", labelSize: { widthMm: 180, heightMm: 30 } });
    expect(narrow.container.querySelector("style")!.textContent).toContain("size: Letter portrait");
    const root = narrow.container.querySelector<HTMLElement>(".print-document")!;
    expect([root.style.getPropertyValue("--page-w"), root.style.getPropertyValue("--page-h")]).toEqual(["215.9mm", "279.4mm"]);
    expect(narrow.container.querySelectorAll(".a4-print-page")[0].querySelectorAll(".a4-label-slot")).toHaveLength(8);
  });

  it("sets the page size of single-label printing to the label size", () => {
    const { container } = renderJob({ mode: "custom", labelSize: { widthMm: 200, heightMm: 25 }, labels: [shoe("a", 3)] });
    expect(container.querySelector("style")!.textContent).toContain("size: 200mm 25mm");
    expect(container.querySelectorAll(".custom-print-page")).toHaveLength(3);
  });

  it("draws the label with a matching aspect ratio", () => {
    const { container } = renderJob({ mode: "custom", labelSize: { widthMm: 200, heightMm: 25 }, labels: [shoe("a")] });
    expect(container.querySelector("svg.label-svg")!.getAttribute("viewBox")).toBe("0 0 1840 230");
  });

  it("prints the selling points at the chosen size", () => {
    const featureSizes = (container: HTMLElement) =>
      [...container.querySelectorAll("svg.label-svg text")].filter((text) => text.getAttribute("y") === "162").map((text) => text.getAttribute("font-size"));
    expect(featureSizes(renderJob({ mode: "custom", labels: [shoe("a")] }).container)).toEqual(["31.5", "31.5", "31.5"]);
    cleanup();
    expect(featureSizes(renderJob({ mode: "custom", labels: [shoe("a")], featureTextScale: 1 }).container)).toEqual(["21", "21", "21"]);
    cleanup();
    expect(featureSizes(renderJob({ mode: "a4", labels: [shoe("a")], featureTextScale: 1.5 }).container)).toEqual(["31.5", "31.5", "31.5"]);
  });

  it("prints the model name and price at the chosen size", () => {
    const { container } = renderJob({ mode: "custom", labels: [shoe("a")], modelTextScale: 1.2, priceTextScale: 1.1 });
    const model = [...container.querySelectorAll("svg.label-svg text")].find((text) => text.textContent === "MODEL A")!;
    expect(Number(model.getAttribute("font-size"))).toBeCloseTo(69.6, 5);
    expect([...container.querySelectorAll("svg.label-svg tspan")].map((tspan) => Number(tspan.getAttribute("font-size")))).toEqual([39.6, 96.8, 55]);
  });

  it("names the label size on the calibration sheet", () => {
    const { container } = renderJob({ kind: "calibration", labels: [], labelSize: { widthMm: 240, heightMm: 28 } });
    expect(container.textContent).toContain("240 × 28 mm CALIBRATION");
    expect(container.textContent).toContain("240 mm");
  });

  it("ignores an out-of-range size instead of printing it", () => {
    const { container } = renderJob({ mode: "custom", labelSize: { widthMm: 5000, heightMm: 2 }, labels: [shoe("a")] });
    expect(container.querySelector("style")!.textContent).not.toContain("5000");
  });
});
