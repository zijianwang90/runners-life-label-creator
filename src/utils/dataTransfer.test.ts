import { describe, expect, it } from "vitest";
import { createDefaultData } from "../data";
import { DATA_BACKUP_FORMAT, backupFileName, createDataBackup, readDataBackup } from "./dataTransfer";

describe("data backup files", () => {
  it("wraps the whole workspace so labels, the print list and settings travel together", () => {
    const data = createDefaultData();
    data.shoes[0].model = "Endorphin Speed 5";
    data.shoes[0].regularPrice = 200;
    data.printCart = [{ id: data.shoes[0].id, copies: 3 }];
    data.settings.paperSize = "a4";

    const exportedAt = new Date("2026-11-11T12:00:00.000Z");
    const backup = createDataBackup(data, "1.6.0", exportedAt);

    expect(backup.format).toBe(DATA_BACKUP_FORMAT);
    expect(backup.backupVersion).toBe(1);
    expect(backup.appVersion).toBe("1.6.0");
    expect(backup.exportedAt).toBe("2026-11-11T12:00:00.000Z");
    expect(backup.data).toEqual(data);
    expect(readDataBackup(JSON.parse(JSON.stringify(backup)))).toMatchObject({
      shoes: [expect.objectContaining({ model: "Endorphin Speed 5" })],
      printCart: [{ id: data.shoes[0].id, copies: 3 }],
      settings: expect.objectContaining({ paperSize: "a4" })
    });
  });

  it("still opens a raw labels.json copied from the app's user-data folder", () => {
    const data = createDefaultData();
    data.shoes[0].model = "Kinvara 16";
    expect(readDataBackup(JSON.parse(JSON.stringify(data))).shoes[0].model).toBe("Kinvara 16");
  });

  it("rejects other JSON files without touching the workspace", () => {
    expect(() => readDataBackup({ format: "something-else", data: { shoes: [] } })).toThrow(/not created by Runners Life/);
    expect(() => readDataBackup({ hello: "world" })).toThrow(/shoe list/);
    expect(() => readDataBackup(null)).toThrow(/not a Runners Life data file/);
  });

  it("names exports by date so several backups stay distinguishable", () => {
    expect(backupFileName(new Date("2026-11-11T23:30:00.000Z"))).toBe("Runners-Life-Label-Data-2026-11-11.json");
  });
});
