import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import type { ShoeLabel } from "../types";
import { ShoeEditor } from "./ShoeEditor";

afterEach(cleanup);

const base: ShoeLabel = {
  id: "s1",
  brand: "saucony",
  model: "Endorphin Speed 5",
  regularPrice: 200,
  salePrice: null,
  features: ["", "", ""],
  specs: { heelStackMm: null, forefootStackMm: null, weightG: null, plate: "" },
  quantity: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
};

function Harness({ initial }: { initial: Partial<ShoeLabel> }) {
  const [shoe, setShoe] = useState<ShoeLabel>({ ...base, ...initial });
  return (
    <ShoeEditor
      shoe={shoe} index={0} selected={false} active canMoveUp={false} canMoveDown={false}
      onSelect={() => undefined} onActivate={() => undefined} onChange={setShoe}
      onDuplicate={() => undefined} onDelete={() => undefined} onMove={() => undefined}
      cartCopies={null} onAddToCart={() => undefined} onCartCopiesChange={() => undefined} onRemoveFromCart={() => undefined}
    />
  );
}

const input = (label: RegExp) => screen.getByLabelText(label) as HTMLInputElement;

describe("sale percent", () => {
  it("sets the sale price from a typed percent", () => {
    render(<Harness initial={{ regularPrice: 229.99 }} />);
    fireEvent.focus(input(/sale %/i));
    fireEvent.change(input(/sale %/i), { target: { value: "20" } });
    expect(input(/sale price/i).value).toBe("183.99");
    expect(screen.getByText("SALE")).toBeTruthy();
    fireEvent.blur(input(/sale %/i));
    expect(input(/sale %/i).value).toBe("20");
  });

  it("follows a typed sale price, and the regular price", () => {
    render(<Harness initial={{}} />);
    fireEvent.change(input(/sale price/i), { target: { value: "150" } });
    expect(input(/sale %/i).value).toBe("25");
    fireEvent.change(input(/regular price/i), { target: { value: "300" } });
    expect(input(/sale %/i).value).toBe("50");
  });

  it("clears the sale price when the percent is cleared and ignores a percent of 100 or more", () => {
    render(<Harness initial={{ salePrice: 150 }} />);
    fireEvent.focus(input(/sale %/i));
    fireEvent.change(input(/sale %/i), { target: { value: "" } });
    expect(input(/sale price/i).value).toBe("");
    fireEvent.change(input(/sale %/i), { target: { value: "120" } });
    expect(input(/sale price/i).value).toBe("");
    expect(screen.getByText("Use 1–99%.")).toBeTruthy();
  });

  it("waits for a regular price", () => {
    render(<Harness initial={{ regularPrice: null }} />);
    expect(input(/sale %/i).disabled).toBe(true);
  });
});

describe("specs", () => {
  it("stores typed stack heights, weight and plate", () => {
    render(<Harness initial={{}} />);
    fireEvent.change(input(/heel stack/i), { target: { value: "39" } });
    fireEvent.change(input(/forefoot stack/i), { target: { value: "31" } });
    fireEvent.change(input(/weight/i), { target: { value: "245" } });
    fireEvent.change(screen.getByLabelText(/plate/i), { target: { value: "carbon" } });
    expect([input(/heel stack/i).value, input(/forefoot stack/i).value, input(/weight/i).value]).toEqual(["39", "31", "245"]);
    expect((screen.getByLabelText(/plate/i) as HTMLSelectElement).value).toBe("carbon");
  });

  it("flags a weight typed in ounces", () => {
    render(<Harness initial={{}} />);
    fireEvent.change(input(/weight/i), { target: { value: "8.6" } });
    expect(screen.getByText(/Weight is in grams/)).toBeTruthy();
  });
});
