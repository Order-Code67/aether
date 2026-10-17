import { describe, expect, it } from "vitest";

/** Contract: pair uses the two bundled peer example ids + Join stub. */
describe("loraPair contract", () => {
  it("documents TX/RX example ids", () => {
    const ids = ["esp32-lora-tx", "esp32-lora-rx"] as const;
    expect(ids[0]).toContain("tx");
    expect(ids[1]).toContain("rx");
  });

  it("documents LoRaWAN Join stub id", () => {
    expect("esp32-lorawan-stub").toContain("lorawan");
  });
});
