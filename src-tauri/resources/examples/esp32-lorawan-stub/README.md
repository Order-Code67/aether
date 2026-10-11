# LoRaWAN OTAA (Join + uplink)

RadioLib OTAA flow for Heltec / TTGO / ESP32 + module:

1. Register the device on [TTN](https://www.thethingsnetwork.org/) or ChirpStack.
2. Put **DevEUI**, **JoinEUI** (AppEUI), **AppKey** into `src/config.h` (or `build_flags`).
3. Pick a board env and matching region (`EU868` / `US915` / `RU864`).
4. Build & upload. Serial shows steps: credentials → radio → Join → uplinks.
5. While developing, enable **Resets DevNonces** on the console.

Uplink interval defaults to **5 minutes** (fair-use). Payload is a tiny demo array.
