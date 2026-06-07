import { describe, it, expect, vi, beforeEach } from "vitest";
import { NMPAAdapter } from "../../../packages/server/src/services/graph/ingest/adapters/nmpa.js";

describe("NMPAAdapter", () => {
  let adapter: NMPAAdapter;

  beforeEach(() => {
    process.env.NMPA_API_KEY = "";
    adapter = new NMPAAdapter();
  });

  it("should have correct metadata", () => {
    expect(adapter.id).toBe("nmpa");
    expect(adapter.name).toContain("China");
    expect(adapter.description).toContain("National Medical");
  });

  it("should return empty array when NMPA_API_KEY is missing", async () => {
    const result = await adapter.fetch();
    expect(result).toEqual([]);
  });

  it("should return empty array on fetch network error", async () => {
    const a = new NMPAAdapter("test-key");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));
    const result = await a.fetch();
    expect(result).toEqual([]);
  });

  it("should use NMPA_API_KEY from env", () => {
    process.env.NMPA_API_KEY = "env-key";
    const a = new NMPAAdapter();
    expect((a as any).apiKey).toBe("env-key");
    delete process.env.NMPA_API_KEY;
  });

  it("should normalize a sample NMPA record correctly", () => {
    const raw = {
      sourceId: "nmpa-CF-2024-12345",
      sourceUrl: "https://udi.nmpa.gov.cn/device/CF-2024-12345",
      raw: {
        companyName: "Siemens Healthineers Diagnostics (Shanghai) Co., Ltd.",
        deviceName: "Atellica CH 930 Analyzer",
        registrationNumber: "CF-2024-12345",
        approvalDate: "2024-06-15",
        applicationArea: "Specialty Proteins & Reagents",
      },
    };
    const result = adapter.normalize(raw);
    expect(result.signals).toHaveLength(1);
    expect(result.signals[0].type).toBe("NMPA_CLEARANCE");
    expect(result.signals[0].confidence).toBe(0.8);
    expect(result.companyName).toBe("Siemens Healthineers Diagnostics (Shanghai) Co., Ltd.");
    expect(result.applicationAreas).toContain("Specialty Proteins & Reagents");
  });

  it("should handle missing Chinese names", () => {
    const raw = {
      sourceId: "nmpa-999",
      sourceUrl: "https://udi.nmpa.gov.cn/device/999",
      raw: {
        companyName: "Test Diagnostics Ltd.",
        companyNameCn: null,
        deviceName: "Test Analyzer",
        deviceNameCn: null,
        registrationNumber: "999",
        approvalDate: "2024-01-01",
        applicationArea: "Infectious Disease & Serology",
      },
    };
    const result = adapter.normalize(raw);
    expect(result.companyName).toBe("Test Diagnostics Ltd.");
    expect(result.signals[0].type).toBe("NMPA_CLEARANCE");
  });

  it("healthCheck returns false when apiKey empty", async () => {
    const healthy = await adapter.healthCheck();
    expect(healthy).toBe(false);
  });

  it("healthCheck returns false on network error", async () => {
    const a = new NMPAAdapter("test-key");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));
    const healthy = await a.healthCheck();
    expect(healthy).toBe(false);
  });

  it("healthCheck returns true on success", async () => {
    const a = new NMPAAdapter("test-key");
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
    } as Response);
    const healthy = await a.healthCheck();
    expect(healthy).toBe(true);
  });
});
