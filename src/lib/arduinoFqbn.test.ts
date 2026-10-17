import { describe, expect, it } from "vitest";
import { pioBoardToFqbn } from "@/lib/arduinoFqbn";

describe("pioBoardToFqbn", () => {
  it("maps common AVR boards", () => {
    expect(pioBoardToFqbn("uno")).toBe("arduino:avr:uno");
    expect(pioBoardToFqbn("megaatmega2560")).toBe("arduino:avr:mega");
    expect(pioBoardToFqbn("nanoatmega328")).toBe("arduino:avr:nano");
  });

  it("maps ESP32 / ESP8266 boards", () => {
    expect(pioBoardToFqbn("esp32dev")).toBe("esp32:esp32:esp32");
    expect(pioBoardToFqbn("nodemcuv2")).toBe("esp8266:esp8266:nodemcuv2");
  });

  it("returns null for unknown or empty", () => {
    expect(pioBoardToFqbn("unknown-board-xyz")).toBeNull();
    expect(pioBoardToFqbn("")).toBeNull();
    expect(pioBoardToFqbn(null)).toBeNull();
  });
});
