import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { LabelSize, ShoeLabel } from "../types";
import { squeezeFor } from "../utils/labelLayout";
import { LabelSvg } from "./LabelSvg";

afterEach(cleanup);

const shoe: ShoeLabel = {
  id: "s1",
  brand: "saucony",
  model: "Endorphin Speed 5",
  regularPrice: 229.99,
  salePrice: 189.99,
  features: ["Race day", "8mm drop", "PWRRUN PB"],
  quantity: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
};

const draw = (size?: LabelSize, featureScale?: number, label: ShoeLabel = shoe) => {
  const { container } = render(<LabelSvg shoe={label} size={size} featureScale={featureScale} />);
  const svg = container.querySelector("svg")!;
  const points = (index: number) => svg.querySelectorAll("polygon")[index].getAttribute("points")!.split(" ").map((pair) => pair.split(",").map(Number));
  // The two content groups of the logo and price blocks; the rotated SALE seal is a group too, but not one of them.
  const transforms = [...svg.querySelectorAll("g[transform]")].map((group) => group.getAttribute("transform")!).filter((transform) => transform.includes("scale("));
  const texts = [...svg.querySelectorAll("text")];
  const separators = [...svg.querySelectorAll("line")].filter((line) => line.getAttribute("y1") !== line.getAttribute("y2") && line.getAttribute("x1") !== "0" && line.getAttribute("x1") !== "600");
  return { svg, points, transforms, texts, separators };
};

describe("label at the approved 220 × 23 mm", () => {
  it("is drawn exactly as the approved design", () => {
    const { svg, points, transforms, texts } = draw();
    expect(svg.getAttribute("viewBox")).toBe("0 0 2200 230");
    expect(points(0)).toEqual([[0, 0], [250, 0], [215, 230], [0, 230]]);
    expect(points(2)).toEqual([[1730, 0], [2200, 0], [2200, 230], [1668, 230]]);
    expect(transforms).toEqual(["translate(0 0) scale(1)", "translate(2200 0) scale(1) translate(-2200 0)"]);

    const model = texts.find((text) => text.textContent === "ENDORPHIN SPEED 5")!;
    expect([model.getAttribute("x"), model.getAttribute("y"), model.getAttribute("font-size")]).toEqual(["650", "105", "58"]);
    const features = texts.filter((text) => text.getAttribute("y") === "162");
    expect(features.map((text) => text.getAttribute("x"))).toEqual(["653", "1007", "1321"]);
    expect(features.map((text) => text.getAttribute("font-size"))).toEqual(["21", "21", "21"]);
    expect(features.every((text) => !text.hasAttribute("textLength"))).toBe(true);
  });

  it("draws the dividers between selling points as before", () => {
    const { separators } = draw();
    expect(separators.map((line) => [line.getAttribute("x1"), line.getAttribute("y1"), line.getAttribute("y2")])).toEqual([["979", "140", "170"], ["1293", "140", "170"]]);
  });
});

describe("selling point text size", () => {
  const featureSizes = (texts: Element[]) => texts.filter((text) => text.getAttribute("y") === "162").map((text) => Number(text.getAttribute("font-size")));

  it("scales the text and its dividers together", () => {
    const { texts, separators } = draw(undefined, 1.5);
    expect(featureSizes(texts)).toEqual([31.5, 31.5, 31.5]);
    expect(separators.map((line) => [line.getAttribute("y1"), line.getAttribute("y2")])).toEqual([["129", "174"], ["129", "174"]]);
  });

  it("makes the text smaller too when asked", () => {
    expect(featureSizes(draw(undefined, 0.8).texts)).toEqual([16.8, 16.8, 16.8]);
  });

  it("treats an unusable value as the approved size", () => {
    expect(featureSizes(draw(undefined, Number.NaN).texts)).toEqual([21, 21, 21]);
    expect(featureSizes(draw(undefined, 9).texts)).toEqual([35.7, 35.7, 35.7]);
  });

  it("lets a phrase that is too long for its space shrink, but not below the approved design's smallest text", () => {
    const long = "A".repeat(32);
    const { texts } = draw(undefined, 1.7, { ...shoe, features: [long, "8mm drop", "PWRRUN PB"] });
    const [first, second, third] = featureSizes(texts);
    expect(first).toBeLessThan(17 * 1.7); // shrunk to fit its slot
    expect(first).toBeGreaterThanOrEqual(17 * 0.8); // never below the approved floor
    expect(texts.filter((text) => text.getAttribute("y") === "162")[0].hasAttribute("textLength")).toBe(false);
    expect([second, third]).toEqual([35.7, 35.7]); // short phrases take the full size
  });

  it("grows with the label: the same scale on a taller label is just a bigger drawing", () => {
    // The drawing is in design units, so the scale does not depend on the physical height.
    expect(featureSizes(draw({ widthMm: 240, heightMm: 30 }, 1.5).texts)).toEqual([31.5, 31.5, 31.5]);
  });
});

describe("narrow label", () => {
  const size = { widthMm: 160, heightMm: 23 };
  const q = squeezeFor(230 * size.widthMm / size.heightMm);

  it("shrinks the logo and price blocks, and keeps the price glued to the right edge", () => {
    const { svg, points, transforms } = draw(size);
    expect(svg.getAttribute("viewBox")).toBe("0 0 1600 230");
    expect(q).toBeCloseTo(0.735, 3);

    const left = points(0);
    expect(left[1][0]).toBeCloseTo(250 * q, 2);
    expect(left[2][0]).toBeCloseTo(215 * q, 2);

    const price = points(2);
    expect(price[1][0]).toBe(1600);
    expect(price[2][0]).toBe(1600);
    expect(price[3][0]).toBeCloseTo(1600 - 532 * q, 2);
    expect(transforms[1]).toContain("translate(1600 ");
  });

  it("scales logo and price content uniformly, so nothing is stretched", () => {
    const { transforms } = draw(size);
    for (const transform of transforms) expect(transform).toMatch(/scale\(0\.73\d*\)/);
    expect(transforms[0]).not.toMatch(/scale\([^)]*[ ,]/);
  });

  it("keeps all text inside the label and clear of the price block", () => {
    const { texts } = draw(size);
    const priceLeft = 1600 - 532 * q;
    const model = texts.find((text) => text.textContent === "ENDORPHIN SPEED 5")!;
    expect(Number(model.getAttribute("x"))).toBeCloseTo(650 * q, 1);
    const features = texts.filter((text) => text.getAttribute("y") === "162");
    expect(features).toHaveLength(3);
    for (const text of features) expect(Number(text.getAttribute("x"))).toBeLessThan(priceLeft);
  });
});

describe("wide label", () => {
  it("leaves the logo and price blocks alone and gives the text the extra room", () => {
    const { svg, points, transforms, texts } = draw({ widthMm: 240, heightMm: 23 });
    expect(svg.getAttribute("viewBox")).toBe("0 0 2400 230");
    expect(points(0)).toEqual([[0, 0], [250, 0], [215, 230], [0, 230]]);
    expect(transforms).toEqual(["translate(0 0) scale(1)", "translate(2400 0) scale(1) translate(-2200 0)"]);
    const features = texts.filter((text) => text.getAttribute("y") === "162").map((text) => Number(text.getAttribute("x")));
    expect(features[2]).toBeGreaterThan(1321);
  });
});
