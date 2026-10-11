import { afterEach, describe, expect, it, vi } from "vitest";
import {
  TimeoutError,
  probeOnline,
  readNavigatorOnline,
  withTimeout,
} from "@/lib/offline";

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

describe("readNavigatorOnline", () => {
  it("returns a boolean", () => {
    expect(typeof readNavigatorOnline()).toBe("boolean");
  });
});

describe("probeOnline", () => {
  it("returns false when navigator reports offline", async () => {
    const desc = Object.getOwnPropertyDescriptor(navigator, "onLine");
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      get: () => false,
    });
    try {
      await expect(probeOnline()).resolves.toBe(false);
    } finally {
      if (desc) Object.defineProperty(navigator, "onLine", desc);
      else delete (navigator as { onLine?: boolean }).onLine;
    }
  });
});
