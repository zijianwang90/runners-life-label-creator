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
    await screen.findByDisplayValue("Endorphin Speed 5");
    expect((cartButton() as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Increase Endorphin Speed 5 copies" }));
    fireEvent.click(screen.getByRole("button", { name: "Increase Endorphin Speed 5 copies" }));
    fireEvent.click(screen.getAllByRole("button", { name: /add to print list/i })[0]);
    expect(within(cartButton()).getByText("3")).toBeTruthy();
    await waitFor(() => expect(saved().printCart).toEqual([{ id: "a", copies: 3 }]));

    // On the list, the card's stepper edits the print list directly.
    fireEvent.click(screen.getByRole("button", { name: "Increase Endorphin Speed 5 copies" }));
    expect(within(cartButton()).getByText("4")).toBeTruthy();

    fireEvent.click(cartButton());
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Print 4 labels" })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Decrease Endorphin Speed 5 copies" }));
    expect(within(dialog).getByRole("heading", { name: "Print 3 labels" })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: /remove/i }));
    expect(within(dialog).getByText(/print list is empty/i)).toBeTruthy();
  });

  it("adds ticked labels with one copy each and refuses incomplete labels", async () => {
    render(<App />);
    await screen.findByDisplayValue("Kinvara 16");
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Kinvara 16" }));
    fireEvent.click(screen.getByRole("button", { name: /add 1 to print list/i }));
    await waitFor(() => expect(saved().printCart).toEqual([{ id: "b", copies: 1 }]));

    fireEvent.click(screen.getAllByRole("button", { name: /add to print list/i })[1]);
    expect(screen.getByText(/complete unpriced before adding/i)).toBeTruthy();
    expect(saved().printCart).toEqual([{ id: "b", copies: 1 }]);
  });
});
