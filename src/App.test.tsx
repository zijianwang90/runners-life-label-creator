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
  it("adds from the row, then edits the same count with the row's stepper", async () => {
    render(<App />);
    await screen.findByRole("button", { name: "Endorphin Speed 5" });
    expect((cartButton() as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByLabelText(/^Model$/)).toBeNull();

    const row = within(screen.getByRole("article", { name: "Endorphin Speed 5" }));
    fireEvent.click(row.getByRole("button", { name: /add to print list/i }));
    expect(row.queryByRole("button", { name: /add to print list/i })).toBeNull();
    fireEvent.click(row.getByRole("button", { name: "Increase Endorphin Speed 5 copies" }));
    fireEvent.click(row.getByRole("button", { name: "Increase Endorphin Speed 5 copies" }));
    expect(within(cartButton()).getByText("3")).toBeTruthy();
    await waitFor(() => expect(saved().printCart).toEqual([{ id: "a", copies: 3 }]));
    expect((row.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);

    fireEvent.click(cartButton());
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Print 3 labels" })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Decrease Endorphin Speed 5 copies" }));
    expect(within(dialog).getByRole("heading", { name: "Print 2 labels" })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: /remove/i }));
    expect(within(dialog).getByText(/print list is empty/i)).toBeTruthy();
  });

  it("removes the label when the row's stepper goes below one", async () => {
    render(<App />);
    await screen.findByRole("button", { name: "Kinvara 16" });
    const row = within(screen.getByRole("article", { name: "Kinvara 16" }));
    fireEvent.click(row.getByRole("button", { name: /add to print list/i }));
    fireEvent.click(row.getByRole("button", { name: "Remove Kinvara 16 from print list" }));
    await waitFor(() => expect(saved().printCart).toEqual([]));
    expect(row.getByRole("button", { name: /add to print list/i })).toBeTruthy();
  });

  it("lets the copies field be cleared while typing", async () => {
    render(<App />);
    await screen.findByRole("button", { name: "Kinvara 16" });
    const row = within(screen.getByRole("article", { name: "Kinvara 16" }));
    fireEvent.click(row.getByRole("button", { name: /add to print list/i }));
    const field = row.getByLabelText("Kinvara 16 print copies") as HTMLInputElement;
    fireEvent.change(field, { target: { value: "" } });
    expect(field.value).toBe("");
    fireEvent.change(field, { target: { value: "5" } });
    await waitFor(() => expect(saved().printCart).toEqual([{ id: "b", copies: 5 }]));
    fireEvent.change(field, { target: { value: "" } });
    fireEvent.blur(field);
    expect(field.value).toBe("5");
  });

  it("adds the ticked labels that are ready and keeps the incomplete one ticked", async () => {
    render(<App />);
    await screen.findByRole("button", { name: "Kinvara 16" });
    fireEvent.click(within(screen.getByRole("article", { name: "Kinvara 16" })).getByRole("button", { name: /add to print list/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select shown" }));
    fireEvent.click(screen.getByRole("button", { name: "Add 3 to print list" }));
    await waitFor(() => expect(saved().printCart).toEqual([{ id: "b", copies: 1 }, { id: "a", copies: 1 }]));
    expect(screen.getByText(/1 label added to the print list \(1 already on it, 1 need completing\)/i)).toBeTruthy();
    expect((screen.getByRole("checkbox", { name: "Select Unpriced" }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("checkbox", { name: "Select Kinvara 16" }) as HTMLInputElement).checked).toBe(false);
  });
});

describe("preview strip", () => {
  it("sits above the list, names the previewed label, and keeps the label settings in a popover", async () => {
    render(<App />);
    await screen.findByRole("button", { name: "Kinvara 16" });
    const strip = within(screen.getByRole("region", { name: "Label preview" }));
    expect(strip.getByText("Endorphin Speed 5")).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: "Label size and text size" })).toBeNull();

    fireEvent.click(strip.getByRole("button", { name: /label size & text/i }));
    const settings = within(screen.getByRole("dialog", { name: "Label size and text size" }));
    expect(settings.getByRole("spinbutton", { name: /width/i })).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Label size and text size" })).toBeNull();

    fireEvent.click(strip.getByRole("button", { name: /label size & text/i }));
    fireEvent.pointerDown(screen.getByPlaceholderText("Search model or brand"));
    expect(screen.queryByRole("dialog", { name: "Label size and text size" })).toBeNull();
  });

  it("says what is missing on the previewed label", async () => {
    render(<App />);
    await screen.findByRole("button", { name: "Unpriced" });
    fireEvent.click(document.querySelector('[data-shoe-id="c"] .shoe-summary')!);
    expect(within(screen.getByRole("region", { name: "Label preview" })).getByText(/enter a price/i)).toBeTruthy();
  });
});

describe("incomplete labels", () => {
  it("say what is missing and open the editor instead of adding, keeping the search", async () => {
    render(<App />);
    await screen.findByRole("button", { name: "Unpriced" });
    fireEvent.change(screen.getByPlaceholderText("Search model or brand"), { target: { value: "Unpriced" } });
    const row = within(screen.getByRole("article", { name: "Unpriced" }));
    expect(row.getByText(/enter a price/i)).toBeTruthy();
    expect(row.queryByRole("button", { name: /add to print list/i })).toBeNull();
    fireEvent.click(row.getByRole("button", { name: "Complete Unpriced" }));
    expect(screen.getByRole("spinbutton", { name: /^regular price/i })).toBeTruthy();
    expect((screen.getByPlaceholderText("Search model or brand") as HTMLInputElement).value).toBe("Unpriced");
  });

  it("can be listed alone, and the open one stays listed once fixed", async () => {
    render(<App />);
    await screen.findByRole("button", { name: "Unpriced" });
    fireEvent.click(screen.getByRole("button", { name: "1 to complete" }));
    expect(screen.queryByRole("article", { name: "Kinvara 16" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Complete Unpriced" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: /^regular price/i }), { target: { value: "150" } });
    expect(screen.getByRole("article", { name: "Unpriced" })).toBeTruthy();
    await waitFor(() => expect(screen.getByRole("article", { name: "Kinvara 16" })).toBeTruthy());
    expect(screen.queryByRole("button", { name: /to complete/ })).toBeNull();
  });
});

describe("compact shoe list", () => {
  it("keeps one editor open and exposes the full label content without changing the label design", async () => {
    render(<App />);
    await screen.findByRole("button", { name: "Kinvara 16" });
    expect(screen.getAllByRole("button", { name: /add to print list/i })).toHaveLength(2);
    expect(within(screen.getByRole("article", { name: "Kinvara 16" })).getByRole("img", { name: "Saucony" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Edit Endorphin Speed 5" }));
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
    fireEvent.click(screen.getByRole("button", { name: "Edit Kinvara 16" }));
    expect(screen.getByRole("button", { name: "Edit Speed 5 edited" }).getAttribute("aria-expanded")).toBe("false");
    expect(document.querySelectorAll(".shoe-details")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(document.querySelectorAll(".shoe-details")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Kinvara 16" })).toHaveFocus();
  });

  it("previews a clicked row without opening its editor, and the print controls leave the preview alone", async () => {
    render(<App />);
    await screen.findByRole("button", { name: "Kinvara 16" });
    const preview = () => document.querySelector(".label-svg")?.textContent;
    expect(preview()).toContain("ENDORPHIN SPEED 5");
    fireEvent.click(document.querySelector('[data-shoe-id="b"] .shoe-summary')!);
    expect(preview()).toContain("KINVARA 16");
    expect(document.querySelectorAll(".shoe-details")).toHaveLength(0);

    fireEvent.click(within(screen.getByRole("article", { name: "Endorphin Speed 5" })).getByRole("button", { name: /add to print list/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Endorphin Speed 5" }));
    expect(preview()).toContain("KINVARA 16");

    fireEvent.doubleClick(screen.getByRole("button", { name: "Endorphin Speed 5" }));
    expect(document.querySelectorAll(".shoe-details")).toHaveLength(1);
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
