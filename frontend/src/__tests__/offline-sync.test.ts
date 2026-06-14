import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPendingLogs, queuePendingLog, syncOfflineLogs } from "@/utils/offlineSync";

describe("offline sync fallback behavior", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns an empty queue when IndexedDB is unavailable", async () => {
    const logs = await getPendingLogs();

    expect(logs).toEqual([]);
  });

  it("returns deterministic counts when no pending records exist", async () => {
    const result = await syncOfflineLogs();

    expect(result).toEqual({ successCount: 0, failedCount: 0 });
  });

  it("falls back to a numeric local id when queue writes fail", async () => {
    const id = await queuePendingLog({
      date: "2026-06-13",
      category: "digital",
      subcategory: "browsing",
      value: 1,
      unit: "hours",
    });

    expect(typeof id).toBe("number");
  });
});
