import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { createDefaultData } from "./data";
import { todayReference } from "./utils/giftCertificate";
import type { ElectronAPI, PrintResult } from "./types";

const print = vi.fn<ElectronAPI["print"]>();
const saveData = vi.fn<ElectronAPI["saveData"]>();

beforeEach(() => {
  const data = createDefaultData();
  data.settings.giftCertificateSigner = "Dave";
  data.shoes[0].model = "Existing shoe";
  data.shoes[0].regularPrice = 100;
  data.printCart = [{ id: data.shoes[0].id, copies: 2 }];
  print.mockReset().mockResolvedValue({ success: true });
  saveData.mockReset().mockResolvedValue();
  window.electronAPI = {
    loadData: vi.fn().mockResolvedValue(data), saveData, print,
    getAppVersion: vi.fn().mockResolvedValue("1.4.0")
  } as unknown as ElectronAPI;
});
afterEach(() => { cleanup(); window.electronAPI = undefined; });

async function openCertificate() {
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "Gift certificate" }));
  return screen.getByRole("dialog", { name: "Gift certificate" });
}

function change(dialog: HTMLElement, label: RegExp, value: string) {
  fireEvent.change(within(dialog).getByLabelText(label), { target: { value } });
}

describe("gift certificate workflow", () => {
  it("prints with blank recipient and sender, keeps the shoe print list, and remembers only the signer", async () => {
    const dialog = await openCertificate();
    expect((within(dialog).getByLabelText(/ref #/i) as HTMLInputElement).value).toBe(todayReference());
    expect((within(dialog).getByLabelText(/signature/i) as HTMLInputElement).value).toBe("Dave");
    expect((within(dialog).getByRole("button", { name: "Create PDF to print" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(dialog).getByRole("button", { name: "$100" }));
    change(dialog, /ref #/i, "20261102-2");
    change(dialog, /signature/i, "Alex");
    fireEvent.click(within(dialog).getByRole("button", { name: "Create PDF to print" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(print).toHaveBeenCalledWith({ kind: "gift-certificate", certificate: { amount: "100", to: "", from: "", signer: "Alex", ref: "20261102-2" } });
    await waitFor(() => expect(saveData.mock.lastCall?.[0].settings.giftCertificateSigner).toBe("Alex"));
    expect(saveData.mock.lastCall?.[0].printCart).toHaveLength(1);
    expect(saveData.mock.lastCall?.[0]).not.toHaveProperty("certificate");
    fireEvent.click(screen.getByRole("button", { name: "Gift certificate" }));
    expect((screen.getByLabelText(/signature/i) as HTMLInputElement).value).toBe("Alex");
    expect((screen.getByLabelText(/amount \(required/i) as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText(/to \(customer/i) as HTMLInputElement).value).toBe("");
  });

  it("updates the preview, rejects invalid amounts and allows the reference to reset to today", async () => {
    const dialog = await openCertificate();
    change(dialog, /to \(customer/i, "Jamie Chen");
    expect(within(dialog).getByText("Jamie Chen")).toBeTruthy();
    change(dialog, /to \(customer/i, "");
    expect(within(dialog).getByText("To:")).toBeTruthy();
    change(dialog, /amount \(required/i, "-50");
    expect((within(dialog).getByRole("button", { name: "Create PDF to print" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(dialog).getByRole("button", { name: "$50" }));
    change(dialog, /ref #/i, " ");
    expect((within(dialog).getByRole("button", { name: "Create PDF to print" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(dialog).getByRole("button", { name: "Today" }));
    expect((within(dialog).getByLabelText(/ref #/i) as HTMLInputElement).value).toBe(todayReference());
  });

  it("blocks duplicate jobs while printing and retains inputs when PDF creation fails", async () => {
    let finish!: (result: PrintResult) => void;
    print.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const dialog = await openCertificate();
    fireEvent.click(within(dialog).getByRole("button", { name: "$200" }));
    change(dialog, /to \(customer/i, "Jamie Chen");
    const button = within(dialog).getByRole("button", { name: "Create PDF to print" });
    fireEvent.click(button);
    fireEvent.keyDown(screen.getByLabelText(/ref #/i), { key: "p", ctrlKey: true });
    expect(print).toHaveBeenCalledTimes(1);
    expect((within(dialog).getByRole("button", { name: "Cancel" }) as HTMLButtonElement).disabled).toBe(true);
    finish({ success: false, reason: "Disk full" });
    await screen.findByText("Disk full");
    expect((within(dialog).getByLabelText(/to \(customer/i) as HTMLInputElement).value).toBe("Jamie Chen");
    expect((within(dialog).getByRole("button", { name: "Create PDF to print" }) as HTMLButtonElement).disabled).toBe(false);
    expect(saveData.mock.lastCall?.[0].settings.giftCertificateSigner).toBe("Dave");
  });
});
