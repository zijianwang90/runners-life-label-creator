import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "./App";

const now = "2026-01-01T00:00:00.000Z";
const label = (id: string, model: string, regularPrice: number | null = 200) => ({
  id, brand: "saucony", model, regularPrice, salePrice: null, features: ["", "", ""],
  summary: "",
  specs: { heelStackMm: null, forefootStackMm: null, weightG: null, plate: "" }, quantity: 1, createdAt: now, updatedAt: now
});

const saved = () => JSON.parse(localStorage.getItem("runners-life-labels") ?? "{}");

beforeEach(() => {
  localStorage.setItem("runners-life-labels", JSON.stringify({ version: 1, shoes: [label("a", "Endorphin Speed 5"), label("b", "Kinvara 16"), label("c", "Unpriced", null)] }));
});
afterEach(() => { cleanup(); localStorage.clear(); });

const cartButton = () => screen.getByRole("button", { name: /^print list/i });

describe("print list (cart)", () => {
  it("adds the chosen copies from the list and lets them be changed in the print window", async () => {
    render(<App />);
    await screen.findByRole("button", { name: "Endorphin Speed 5" });
    expect((cartButton() as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByLabelText(/^Model$/)).toBeNull();

    const row = within(screen.getByRole("article", { name: "Endorphin Speed 5" }));
    fireEvent.change(row.getByLabelText("Endorphin Speed 5 print copies"), { target: { value: "3" } });
    fireEvent.click(row.getByRole("button", { name: /add to print list/i }));
    expect(within(cartButton()).getByText("3")).toBeTruthy();
    await waitFor(() => expect(saved().printCart).toEqual([{ id: "a", copies: 3 }]));

    // Row actions add more copies without checking a box or expanding the editor.
    fireEvent.change(row.getByLabelText("Endorphin Speed 5 print copies"), { target: { value: "1" } });
    fireEvent.click(row.getByRole("button", { name: /add to print list/i }));
    expect(within(cartButton()).getByText("4")).toBeTruthy();
    expect(row.getByText("On the print list · 4")).toBeTruthy();
    expect((row.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);

    fireEvent.click(cartButton());
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Print 4 labels" })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Decrease Endorphin Speed 5 copies" }));
    expect(within(dialog).getByRole("heading", { name: "Print 3 labels" })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: /remove/i }));
    expect(within(dialog).getByText(/print list is empty/i)).toBeTruthy();
  });

  it("adds filtered rows directly and expands an incomplete label without adding it", async () => {
    render(<App />);
    await screen.findByRole("button", { name: "Kinvara 16" });
    fireEvent.change(screen.getByPlaceholderText("Search model or brand"), { target: { value: "Kinvara" } });
    fireEvent.click(screen.getByRole("button", { name: /add to print list/i }));
    await waitFor(() => expect(saved().printCart).toEqual([{ id: "b", copies: 1 }]));

    fireEvent.change(screen.getByPlaceholderText("Search model or brand"), { target: { value: "Unpriced" } });
    fireEvent.click(screen.getByRole("button", { name: /add to print list/i }));
    expect(screen.getByText(/complete unpriced before adding/i)).toBeTruthy();
    expect(saved().printCart).toEqual([{ id: "b", copies: 1 }]);
    expect(screen.getByRole("spinbutton", { name: /^regular price/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Close Unpriced" }).getAttribute("aria-expanded")).toBe("true");
  });
});

describe("compact shoe list", () => {
  it("keeps one editor open and exposes the full label content without changing the label design", async () => {
    render(<App />);
    await screen.findByRole("button", { name: "Kinvara 16" });
    expect(screen.getAllByRole("button", { name: /add to print list/i })).toHaveLength(3);
    expect(within(screen.getByRole("article", { name: "Kinvara 16" })).getByRole("img", { name: "Saucony" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Endorphin Speed 5" }));
    fireEvent.change(screen.getByLabelText(/^Model$/), { target: { value: "Speed 5 edited" } });
    fireEvent.click(screen.getByRole("tab", { name: "Selling points & specs" }));
    fireEvent.keyDown(screen.getByRole("tab", { name: "Selling points & specs" }), { key: "ArrowLeft" });
    expect(screen.getByRole("tab", { name: "Brand & price" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("tab", { name: "Brand & price" }), { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Selling points & specs" })).toHaveFocus();
    fireEvent.change(screen.getByLabelText(/^Summary/), { target: { value: "For runners chasing faster tempo runs" } });
    fireEvent.change(screen.getByLabelText(/weight/i), { target: { value: "233" } });
    await waitFor(() => expect(saved().shoes[0].specs.weightG).toBe(233));
    expect(document.querySelector(".label-svg")?.textContent).toContain("FOR RUNNERS CHASING FASTER TEMPO RUNS");
    fireEvent.click(screen.getByRole("button", { name: "Kinvara 16" }));
    expect(screen.getByRole("button", { name: "Edit Speed 5 edited" }).getAttribute("aria-expanded")).toBe("false");
    expect(document.querySelectorAll(".shoe-details")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(document.querySelectorAll(".shoe-details")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Kinvara 16" })).toHaveFocus();
  });

  it("opens a new shoe for editing even when filters hide it", async () => {
    render(<App />);
    await screen.findByRole("button", { name: "Kinvara 16" });
    fireEvent.change(screen.getByPlaceholderText("Search model or brand"), { target: { value: "Kinvara" } });
    fireEvent.click(screen.getByRole("button", { name: "Add shoe" }));
    expect((screen.getByPlaceholderText("Search model or brand") as HTMLInputElement).value).toBe("");
    await waitFor(() => expect(screen.getByRole("textbox", { name: /^Model/ })).toHaveFocus());
    expect(screen.getByRole("button", { name: "Close shoe 4" }).getAttribute("aria-expanded")).toBe("true");
  });
});
