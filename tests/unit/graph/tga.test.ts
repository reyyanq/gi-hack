import { describe, it, expect, vi, beforeEach } from "vitest";
import { TGAAdapter } from "../../../packages/server/src/services/graph/ingest/adapters/tga.js";

describe("TGAAdapter", () => {
  let adapter: TGAAdapter;

  beforeEach(() => {
    adapter = new TGAAdapter();
  });

  it("should have correct metadata", () => {
    expect(adapter.id).toBe("tga");
    expect(adapter.name).toContain("Australia");
    expect(adapter.description).toContain("Australian Register");
  });

  it("should return empty array on fetch network error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));
    const result = await adapter.fetch();
    expect(result).toEqual([]);
  });

  it("should return empty array on non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);
    const result = await adapter.fetch();
    expect(result).toEqual([]);
  });

  it("should normalize a sample TGA record correctly", () => {
    const raw = {
      sourceId: "tga-123456",
      sourceUrl: "https://www.tga.gov.au/artg/123456",
      raw: {
        companyName: "ResMed Australia Pty Ltd",
        productName: "Sleep Apnea Diagnostic Device",
        artgNumber: "123456",
        category: "Class IIa",
        approvalDate: "2023-11-01",
        applicationArea: "Cardiac Markers",
      },
    };
    const result = adapter.normalize(raw);
    expect(result.signals).toHaveLength(1);
    expect(result.signals[0].type).toBe("TGA_CLEARANCE");
    expect(result.signals[0].confidence).toBe(0.85);
    expect(result.companyName).toBe("ResMed Australia Pty Ltd");
    expect(result.applicationAreas).toContain("Cardiac Markers");
    expect(result.signals[0].date).toBe("2023-11-01");
  });

  it("should handle missing optional fields gracefully", () => {
    const raw = {
      sourceId: "tga-999999",
      sourceUrl: "https://www.tga.gov.au/artg/999999",
      raw: {
        companyName: "Test Diagnostics Ltd",
        productName: "Test Kit",
        artgNumber: "999999",
        category: "Class I",
        approvalDate: "",
        applicationArea: "Infectious Disease & Serology",
      },
    };
    const result = adapter.normalize(raw);
    expect(result.companyName).toBe("Test Diagnostics Ltd");
    expect(result.signals[0].date).toBeTruthy();
  });

  it("healthCheck returns false on network error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));
    const healthy = await adapter.healthCheck();
    expect(healthy).toBe(false);
  });

  it("healthCheck returns true on success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
    } as Response);
    const healthy = await adapter.healthCheck();
    expect(healthy).toBe(true);
  });

  it("should skip records with non-ACTIVE status", async () => {
    const mockData = {
      results: [
        { artgNumber: "1", companyName: "Active Co", productName: "A", status: "ACTIVE", category: "" },
        { artgNumber: "2", companyName: "Expired Co", productName: "B", status: "EXPIRED", category: "" },
        { artgNumber: "3", companyName: "Active Co 2", productName: "C", status: "ACTIVE", category: "" },
      ],
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    } as Response);
    const result = await adapter.fetch();
    expect(result).toHaveLength(2);
  });
});
