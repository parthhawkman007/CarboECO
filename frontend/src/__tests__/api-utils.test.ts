/**
 * api-utils.test.ts – Tests for the API URL resolution logic in api.ts.
 *
 * Coverage:
 *  - getApiUrl() returns localhost when NEXT_PUBLIC_API_URL is not set and
 *    window.location is not a Firebase hostname
 *  - getApiUrl() returns the env var when NEXT_PUBLIC_API_URL is set
 *  - getApiUrl() returns the production backend when hostname is *.web.app
 *  - getApiUrl() returns the production backend when hostname is *.firebaseapp.com
 *  - getWsUrl() correctly translates http → ws and https → wss
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// We need to import getApiUrl and getWsUrl AFTER setting up the mocks,
// so we use a dynamic import inside each test.
const PROD_BACKEND = "https://carboeco-backend-570867036028.asia-south1.run.app";

function mockWindow(hostname: string) {
  Object.defineProperty(window, "location", {
    writable: true,
    value: { hostname },
  });
}

describe("getApiUrl()", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns localhost fallback when no env var and not on Firebase", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    mockWindow("localhost");
    const { getApiUrl } = await import("@/utils/api");
    expect(getApiUrl()).toBe("http://localhost:8000");
  });

  it("returns NEXT_PUBLIC_API_URL when env var is set", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://custom-backend.example.com");
    mockWindow("localhost");
    const { getApiUrl } = await import("@/utils/api");
    expect(getApiUrl()).toBe("https://custom-backend.example.com");
  });

  it("returns production backend when hostname ends with .web.app", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    mockWindow("carboeco-xyz.web.app");
    const { getApiUrl } = await import("@/utils/api");
    expect(getApiUrl()).toBe(PROD_BACKEND);
  });

  it("returns production backend when hostname includes firebaseapp.com", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    mockWindow("carboeco-xyz.firebaseapp.com");
    const { getApiUrl } = await import("@/utils/api");
    expect(getApiUrl()).toBe(PROD_BACKEND);
  });
});

describe("getWsUrl()", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("converts http:// to ws://", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:8000");
    mockWindow("localhost");
    const { getWsUrl } = await import("@/utils/api");
    expect(getWsUrl()).toBe("ws://localhost:8000");
  });

  it("converts https:// to wss://", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://carboeco-backend-570867036028.asia-south1.run.app");
    mockWindow("localhost");
    const { getWsUrl } = await import("@/utils/api");
    expect(getWsUrl()).toBe("wss://carboeco-backend-570867036028.asia-south1.run.app");
  });
});
