#ifndef AETHER_LORAWAN_CONFIG_H
#define AETHER_LORAWAN_CONFIG_H

#include <Arduino.h>
#include <RadioLib.h>
#include <SPI.h>

#ifndef AETHER_LORA_NSS
#define AETHER_LORA_NSS 8
#endif
#ifndef AETHER_LORA_DIO
#define AETHER_LORA_DIO 14
#endif
#ifndef AETHER_LORA_RST
#define AETHER_LORA_RST 12
#endif
#ifndef AETHER_LORA_BUSY
#define AETHER_LORA_BUSY 13
#endif
#ifndef AETHER_LORA_SCK
#define AETHER_LORA_SCK 9
#endif
#ifndef AETHER_LORA_MISO
#define AETHER_LORA_MISO 11
#endif
#ifndef AETHER_LORA_MOSI
#define AETHER_LORA_MOSI 10
#endif

// Uplink period — respect TTN fair-use (starter uses 5 minutes).
const uint32_t uplinkIntervalSeconds = 5UL * 60UL;

// JoinEUI (formerly AppEUI). Often 0 for TTN.
#ifndef RADIOLIB_LORAWAN_JOIN_EUI
#define RADIOLIB_LORAWAN_JOIN_EUI 0x0000000000000000ULL
#endif

// Device EUI from the console (MSB). REPLACE before Join.
#ifndef RADIOLIB_LORAWAN_DEV_EUI
#define RADIOLIB_LORAWAN_DEV_EUI 0x0000000000000000ULL
#endif

// AppKey (and NwkKey for LoRaWAN 1.0.x — often identical). REPLACE — 16 bytes.
#ifndef RADIOLIB_LORAWAN_APP_KEY
#define RADIOLIB_LORAWAN_APP_KEY                                                       \
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, \
      0x00, 0x00
#endif
#ifndef RADIOLIB_LORAWAN_NWK_KEY
#define RADIOLIB_LORAWAN_NWK_KEY RADIOLIB_LORAWAN_APP_KEY
#endif

#if defined(AETHER_LORA_REGION_US915)
const LoRaWANBand_t Region = US915;
const uint8_t subBand = 2;
#elif defined(AETHER_LORA_REGION_RU864)
#if defined(RU864)
const LoRaWANBand_t Region = RU864;
#else
const LoRaWANBand_t Region = EU868;
#endif
const uint8_t subBand = 0;
#else
const LoRaWANBand_t Region = EU868;
const uint8_t subBand = 0;
#endif

uint64_t joinEUI = RADIOLIB_LORAWAN_JOIN_EUI;
uint64_t devEUI = RADIOLIB_LORAWAN_DEV_EUI;
uint8_t appKey[] = {RADIOLIB_LORAWAN_APP_KEY};
uint8_t nwkKey[] = {RADIOLIB_LORAWAN_NWK_KEY};

#if defined(AETHER_RADIO_SX126X)
SX1262 radio = new Module(AETHER_LORA_NSS, AETHER_LORA_DIO, AETHER_LORA_RST,
                          AETHER_LORA_BUSY);
#else
SX1276 radio = new Module(AETHER_LORA_NSS, AETHER_LORA_DIO, AETHER_LORA_RST,
                          AETHER_LORA_BUSY);
#endif

LoRaWANNode node(&radio, &Region, subBand);

String stateDecode(const int16_t result) {
  switch (result) {
    case RADIOLIB_ERR_NONE:
      return "ERR_NONE";
    case RADIOLIB_ERR_CHIP_NOT_FOUND:
      return "ERR_CHIP_NOT_FOUND";
    case RADIOLIB_ERR_NETWORK_NOT_JOINED:
      return "ERR_NETWORK_NOT_JOINED";
    case RADIOLIB_ERR_NO_JOIN_ACCEPT:
      return "ERR_NO_JOIN_ACCEPT";
    case RADIOLIB_ERR_JOIN_NONCE_INVALID:
      return "ERR_JOIN_NONCE_INVALID";
    case RADIOLIB_LORAWAN_SESSION_RESTORED:
      return "LORAWAN_SESSION_RESTORED";
    case RADIOLIB_LORAWAN_NEW_SESSION:
      return "LORAWAN_NEW_SESSION";
    default:
      return "see RadioLib status codes";
  }
}

void debugHalt(bool failed, const char *message, int state) {
  if (!failed) return;
  Serial.printf("%s — %s (%d)\n", message, stateDecode(state).c_str(), state);
  while (true) delay(1000);
}

void debugWarn(bool failed, const char *message, int state) {
  if (!failed) return;
  Serial.printf("%s — %s (%d)\n", message, stateDecode(state).c_str(), state);
}

#endif
