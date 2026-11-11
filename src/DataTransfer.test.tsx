import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { createDefaultData } from "./data";
import type { ElectronAPI, ImportDataResult, DataTransferResult } from "./types";
import { createDataBackup } from "./utils/dataTransfer";

const loadData = vi.fn<ElectronAPI["loadData"]>();
const saveData = vi.fn<ElectronAPI["saveData"]>();
const exportData = vi.fn<(backup: Parameters<ElectronAPI["exportData"]>[0]) => Promise<DataTransferResult>>();
const importData = vi.fn<() => Promise<ImportDataResult>>();

beforeEach(() => {
  const data = createDefaultData();
  data.shoes = [{
    ...data.shoes[0],
    id: "existing",
    model: "Existing shoe",
    regularPrice: 180,
    features: ["A", "B", "C"]
  }];
  loadData.mockReset().mockResolvedValue(data);
  saveData.mockReset().mockResolvedValue();
  exportData.mockReset().mockResolvedValue({ success: true, filePath: "/Users/shop/Documents/Runners-Life-Label-Data-2026-11-11.json" });
  importData.mockReset();
  window.electronAPI = {
    loadData, saveData, exportData, importData,
    getAppVersion: vi.fn().mockResolvedValue("1.6.0")
  } as unknown as ElectronAPI;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.electronAPI = undefined;
});

async function openDataDialog() {
  render(<App />);
  await screen.findByRole("button", { name: "Existing shoe" });
  fireEvent.click(screen.getByRole("button", { name: "Export / import" }));
  return screen.getByRole("dialog", { name: "Export and import data" });
}

describe("data export and import", () => {
  it("exports labels, the print list and settings through one desktop save dialog", async () => {
    const dialog = await openDataDialog();
    fireEvent.click(within(dialog).getByRole("button", { name: "Export data" }));

    await waitFor(() => expect(exportData).toHaveBeenCalledTimes(1));
    const backup = exportData.mock.calls[0][0];
    expect(backup.format).toBe("runners-life-label-creator-backup");
    expect(backup.appVersion).toBe("1.6.0");
    expect(backup.data.shoes[0].model).toBe("Existing shoe");
    expect(screen.getByText(/Data exported to/)).toBeTruthy();
  });

  it("asks before replacing the workspace, then saves the imported labels", async () => {
    const imported = createDefaultData();
    imported.shoes = [
      { ...imported.shoes[0], id: "new-a", model: "Imported Speed", regularPrice: 220, features: ["A", "B", "C"] },
      { ...imported.shoes[0], id: "new-b", model: "Imported Kinvara", regularPrice: 140, features: ["A", "B", "C"] }
    ];
    imported.settings.paperSize = "a4";
    importData.mockResolvedValue({ success: true, data: createDataBackup(imported, "1.6.0") });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);

    const dialog = await openDataDialog();
    fireEvent.click(within(dialog).getByRole("button", { name: "Import data" }));

    await waitFor(() => expect(confirm).toHaveBeenCalledWith(expect.stringMatching(/2 labels and settings/)));
    expect(await screen.findByRole("button", { name: "Imported Speed" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Existing shoe" })).toBeNull();
    await waitFor(() => expect(saveData.mock.lastCall?.[0].shoes.map((shoe) => shoe.model)).toEqual(["Imported Speed", "Imported Kinvara"]));
    expect(saveData.mock.lastCall?.[0].settings.paperSize).toBe("a4");
    expect(screen.getByText(/Imported 2 labels and all settings/)).toBeTruthy();
  });

  it("leaves the current labels alone when the import is canceled", async () => {
    importData.mockResolvedValue({ success: false, canceled: true });
    const confirm = vi.spyOn(window, "confirm");
    const dialog = await openDataDialog();
    fireEvent.click(within(dialog).getByRole("button", { name: "Import data" }));

    await waitFor(() => expect(importData).toHaveBeenCalledTimes(1));
    expect(confirm).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Existing shoe" })).toBeTruthy();
  });
});
