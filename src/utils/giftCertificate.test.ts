import { describe, expect, it } from "vitest";
import { certificateAmount, certificateError, createGiftCertificate, todayReference } from "./giftCertificate";
import { createDefaultData, normalizeAppData } from "../data";

describe("gift certificates", () => {
  it("uses the local calendar date with padded month and day", () => {
    expect(todayReference(new Date(2026, 0, 2, 0, 5))).toBe("20260102");
    expect(todayReference(new Date(2026, 10, 2))).toBe("20261102");
  });

  it("allows blank names and signature, and custom reference numbers", () => {
    expect(certificateError({ ...createGiftCertificate(), amount: "100", ref: "20261102-2" })).toBeNull();
    expect(certificateError({ ...createGiftCertificate(), amount: "100", ref: " " })).not.toBeNull();
  });

  it("rejects invalid monetary values without silently rounding them", () => {
    for (const amount of ["", "0", "-1", "1.234", "1e3", "Infinity", "abc", "1000000", "1,000"]) {
      expect(certificateError({ ...createGiftCertificate(), amount })).not.toBeNull();
    }
    for (const amount of ["0.01", "50", "125.5", "999999.99"]) {
      expect(certificateError({ ...createGiftCertificate(), amount })).toBeNull();
    }
    expect(certificateAmount("125.5")).toBe("$125.50");
    expect(certificateAmount("1000")).toBe("$1,000");
  });

  it("loads existing data without a signer setting and preserves the last signer", () => {
    const data = createDefaultData();
    expect(normalizeAppData({ ...data, settings: {} }).settings.giftCertificateSigner).toBe("");
    data.settings.giftCertificateSigner = "Dave";
    expect(normalizeAppData(data).settings.giftCertificateSigner).toBe("Dave");
  });
});
