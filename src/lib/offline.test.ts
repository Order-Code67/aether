import { afterEach, describe, expect, it, vi } from "vitest";
import {
  TimeoutError,
  isNavigatorOffline,
  probeOnline,
  readNavigatorOnline,
  shouldHardBlockNetwork,
  withTimeout,
} from "@/lib/offline";

function stubNavigatorOnline(online: boolean): () => void {
  const desc = Object.getOwnPropertyDescriptor(navigator, "onLine");
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    get: () => online,
  });
  return () => {
    if (desc) Object.defineProperty(navigator, "onLine", desc);
    else delete (navigator as { onLine?: boolean }).onLine;
  };
}

describe("withTimeout", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves when the promise wins", async () => {
    await expect(withTimeout(Promise.resolve(42), 1000)).resolves.toBe(42);
  });

  it("rejects with TimeoutError when time expires", async () => {
    vi.useFakeTimers();
    const pending = withTimeout(new Promise(() => undefined), 100, "slow");
    const assertion = expect(pending).rejects.toSatisfy(
      (e: unknown) => e instanceof TimeoutError && e.message === "slow",
    );
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
  });
});

describe("readNavigatorOnline / hard offline gate", () => {
  it("returns a boolean", () => {
    expect(typeof readNavigatorOnline()).toBe("boolean");
  });

  it("hard-blocks only when navigator.onLine is false", () => {
    const restore = stubNavigatorOnline(false);
    try {
      expect(isNavigatorOffline()).toBe(true);
      expect(shouldHardBlockNetwork()).toBe(true);
      expect(readNavigatorOnline()).toBe(false);
    } finally {
      restore();
    }
  });

  it("does not hard-block when navigator reports online", () => {
    const restore = stubNavigatorOnline(true);
    try {
      expect(isNavigatorOffline()).toBe(false);
      expect(shouldHardBlockNetwork()).toBe(false);
      expect(readNavigatorOnline()).toBe(true);
    } finally {
      restore();
    }
  });
});

describe("probeOnline", () => {
  it("returns false when navigator reports offline", async () => {
    const restore = stubNavigatorOnline(false);
    try {
      await expect(probeOnline()).resolves.toBe(false);
    } finally {
      restore();
    }
  });

  it("returns true if any probe endpoint succeeds", async () => {
    const restore = stubNavigatorOnline(true);
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("blocked"))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      await expect(probeOnline()).resolves.toBe(true);
      expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    } finally {
      vi.unstubAllGlobals();
      restore();
    }
  });
});
