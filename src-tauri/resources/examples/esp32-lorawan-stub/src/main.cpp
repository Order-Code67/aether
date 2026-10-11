#include "config.h"

// Aether LoRaWAN OTAA wizard sketch:
// Step 1 — set credentials in config.h (or build_flags)
// Step 2 — Join (activateOTAA)
// Step 3 — periodic uplink

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println();
  Serial.println("=== Aether LoRaWAN OTAA ===");
  Serial.println("Step 0: credentials");
  Serial.printf("  DevEUI  = %016llX\n", (unsigned long long)devEUI);
  Serial.printf("  JoinEUI = %016llX\n", (unsigned long long)joinEUI);
  if (devEUI == 0) {
    Serial.println("ERROR: DevEUI is still 0 — set RADIOLIB_LORAWAN_DEV_EUI in config.h");
    Serial.println("Also set AppKey (and NwkKey). Then rebuild & upload.");
    while (true) delay(1000);
  }

  Serial.println("Step 1: SPI + radio init");
  SPI.begin(AETHER_LORA_SCK, AETHER_LORA_MISO, AETHER_LORA_MOSI, AETHER_LORA_NSS);
  Serial.printf("  Pins NSS=%d DIO=%d RST=%d BUSY=%d\n", AETHER_LORA_NSS,
                AETHER_LORA_DIO, AETHER_LORA_RST, AETHER_LORA_BUSY);

  int state = radio.begin();
  debugHalt(state != RADIOLIB_ERR_NONE, "Radio init failed (SPI/NSS/RST/antenna)",
            state);

  Serial.println("Step 2: OTAA session keys");
  state = node.beginOTAA(joinEUI, devEUI, nwkKey, appKey);
  debugHalt(state != RADIOLIB_ERR_NONE, "beginOTAA failed", state);

  Serial.println("Step 3: Join network (wait for JoinAccept)…");
  Serial.println("  Tip: TTN → device → General settings → Resets DevNonces (dev)");
  state = node.activateOTAA();
  // NEW_SESSION or SESSION_RESTORED both mean we can uplink
  if (state != RADIOLIB_LORAWAN_NEW_SESSION &&
      state != RADIOLIB_LORAWAN_SESSION_RESTORED) {
    debugHalt(true, "Join failed", state);
  }
  Serial.printf("Join OK — %s\n", stateDecode(state).c_str());
  Serial.println("Step 4: uplink loop starting");
  Serial.printf("  Interval %lu s (fair-use)\n",
                (unsigned long)uplinkIntervalSeconds);
}

void loop() {
  Serial.println("--- Uplink ---");
  uint8_t value1 = radio.random(100);
  uint16_t value2 = radio.random(2000);
  uint8_t uplinkPayload[3];
  uplinkPayload[0] = value1;
  uplinkPayload[1] = highByte(value2);
  uplinkPayload[2] = lowByte(value2);
  Serial.printf("Payload: %02X %02X %02X\n", uplinkPayload[0], uplinkPayload[1],
                uplinkPayload[2]);

  int16_t state = node.sendReceive(uplinkPayload, sizeof(uplinkPayload));
  debugWarn(state < RADIOLIB_ERR_NONE, "sendReceive error", state);
  if (state > 0) {
    Serial.println("Downlink received");
  } else if (state == RADIOLIB_ERR_NONE) {
    Serial.println("Uplink OK, no downlink");
  }

  Serial.printf("Next uplink in %lu s\n\n",
                (unsigned long)uplinkIntervalSeconds);
  delay(uplinkIntervalSeconds * 1000UL);
}
