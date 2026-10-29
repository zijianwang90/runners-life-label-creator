import { describe, expect, it } from "vitest";
import type { ShoeLabel } from "../types";
import { addToCart, cartCopyCount, cartLabels, clampCopies, normalizeCart, removeFromCart, setCartCopies } from "./cart";

const shoe = (id: string): ShoeLabel => ({
  id,
  brand: "saucony",
  model: `Shoe ${id}`,
  regularPrice: 200,
  salePrice: null,
  features: ["", "", ""],
  summary: "",
  specs: { heelStackMm: null, forefootStackMm: null, weightG: null, plate: "" },
  quantity: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
});

describe("print list", () => {
  it("adds labels in order and tops up a label already on it", () => {
    let cart = addToCart([], "a", 3);
    cart = addToCart(cart, "b", 1);
    cart = addToCart(cart, "a", 2);
    expect(cart).toEqual([{ id: "a", copies: 5 }, { id: "b", copies: 1 }]);
    expect(cartCopyCount(cart)).toBe(6);
  });

  it("keeps copies within 1–99", () => {
    expect(addToCart([{ id: "a", copies: 98 }], "a", 5)).toEqual([{ id: "a", copies: 99 }]);
    expect(setCartCopies([{ id: "a", copies: 4 }], "a", 0)).toEqual([{ id: "a", copies: 1 }]);
    expect([clampCopies("7"), clampCopies("x"), clampCopies(2.6)]).toEqual([7, 1, 3]);
  });

  it("removes a label", () => {
    expect(removeFromCart([{ id: "a", copies: 2 }, { id: "b", copies: 1 }], "a")).toEqual([{ id: "b", copies: 1 }]);
  });

  it("turns the list into labels to print, copies as quantity, skipping deleted labels", () => {
    const labels = cartLabels([{ id: "b", copies: 4 }, { id: "gone", copies: 2 }, { id: "a", copies: 1 }], [shoe("a"), shoe("b")]);
    expect(labels.map((label) => [label.id, label.quantity])).toEqual([["b", 4], ["a", 1]]);
  });

  it("cleans up a saved list", () => {
    expect(normalizeCart([{ id: "a", copies: 500 }, { id: "a", copies: 2 }, { id: "zz", copies: 1 }, "junk", { id: "b" }], new Set(["a", "b"])))
      .toEqual([{ id: "a", copies: 99 }, { id: "b", copies: 1 }]);
    expect(normalizeCart(undefined, new Set(["a"]))).toEqual([]);
  });
});
