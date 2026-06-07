import { describe, it, expect, vi, beforeEach } from "vitest";
import { MFDSAdapter } from "../../../packages/server/src/services/graph/ingest/adapters/mfds.js";

describe("MFDSAdapter", () => {
  let adapter: MFDSAdapter;

  beforeEach(() => {
    vi.stubEnv("MFDS_API_KEY", "");
    adapter = new MFDSAdapter();
  });

  it("should have correct metadata", () => {
    expect(adapter.id).toBe("mfds");
    expect(adapter.name).toContain("Korea");
    expect(adapter.description).toContain("South Korea");
  });

  it("should return empty array when MFDS_API_KEY is not set", async () => {
    const result = await adapter.fetch();
    expect(result).toEqual([]);
  });

  it("should return empty array on fetch network error", async () => {
    const a = new MFDSAdapter("test-key");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));
    const result = await a.fetch();
    expect(result).toEqual([]);
  });

  it("should return empty array on non-ok response", async () => {
    const a = new MFDSAdapter("test-key");
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);
    const result = await a.fetch();
    expect(result).toEqual([]);
  });

  it("should use MFDS_API_KEY from env", () => {
    process.env.MFDS_API_KEY = "env-key";
    const a = new MFDSAdapter();
    expect((a as any).apiKey).toBe("env-key");
    delete process.env.MFDS_API_KEY;
  });

  it("should normalize a sample MFDS record correctly", () => {
    const raw = {
      sourceId: "mfds-K-12345",
      sourceUrl: "https://www.mfds.go.kr/eng/device/K-12345",
      raw: {
        companyName: "Samsung Medison Co. Ltd.",
        deviceName: "Ultrasound Diagnostic System",
        itemName: "RS85 Prestige",
        approvalDate: "2024-03-20",
        classification: "Class II",
        applicationArea: "Cardiac Markers",
      },
    };
    const result = adapter.normalize(raw);
    expect(result.signals).toHaveLength(1);
    expect(result.signals[0].type).toBe("MFDS_CLEARANCE");
    expect(result.signals[0].confidence).toBe(0.8);
    expect(result.applicationAreas).toContain("Cardiac Markers");
    expect(result.companyName).toBe("Samsung Medison Co. Ltd.");
  });

  it("healthCheck returns false when apiKey is empty", async () => {
    const healthy = await adapter.healthCheck();
    expect(healthy).toBe(false);
  });

  it("healthCheck returns false on network error", async () => {
    const a = new MFDSAdapter("test-key");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));
    const healthy = await a.healthCheck();
    expect(healthy).toBe(false);
  });

  it("healthCheck returns true on success", async () => {
    const a = new MFDSAdapter("test-key");
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
    } as Response);
    const healthy = await a.healthCheck();
    expect(healthy).toBe(true);
  });
});
