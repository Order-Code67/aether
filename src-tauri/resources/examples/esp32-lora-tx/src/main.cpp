#include <Arduino.h>
#include <RadioLib.h>
#include <SPI.h>

#ifndef AETHER_LORA_NSS
#define AETHER_LORA_NSS 5
#endif
#ifndef AETHER_LORA_DIO
#define AETHER_LORA_DIO 26
#endif
#ifndef AETHER_LORA_RST
#define AETHER_LORA_RST 14
#endif
#ifndef AETHER_LORA_BUSY
#define AETHER_LORA_BUSY -1
#endif
#ifndef AETHER_LORA_SCK
#define AETHER_LORA_SCK 18
#endif
#ifndef AETHER_LORA_MISO
#define AETHER_LORA_MISO 19
#endif
#ifndef AETHER_LORA_MOSI
#define AETHER_LORA_MOSI 23
#endif
#ifndef AETHER_LORA_FREQ
#define AETHER_LORA_FREQ 868.1
#endif
#ifndef AETHER_LORA_SF
#define AETHER_LORA_SF 7
#endif
#ifndef AETHER_LORA_BW
#define AETHER_LORA_BW 125.0
#endif

#if defined(AETHER_RADIO_SX126X)
SX1262 radio = new Module(AETHER_LORA_NSS, AETHER_LORA_DIO, AETHER_LORA_RST, AETHER_LORA_BUSY);
#else
SX1276 radio = new Module(AETHER_LORA_NSS, AETHER_LORA_DIO, AETHER_LORA_RST, AETHER_LORA_BUSY);
#endif

uint32_t counter = 0;

void setup() {
  Serial.begin(115200);
  delay(200);
  SPI.begin(AETHER_LORA_SCK, AETHER_LORA_MISO, AETHER_LORA_MOSI, AETHER_LORA_NSS);

  Serial.printf("Aether LoRa TX  freq=%.1f SF=%d\n", (double)AETHER_LORA_FREQ, AETHER_LORA_SF);
  Serial.printf("Pins NSS=%d DIO=%d RST=%d BUSY=%d\n", AETHER_LORA_NSS, AETHER_LORA_DIO, AETHER_LORA_RST, AETHER_LORA_BUSY);

  int state = radio.begin(AETHER_LORA_FREQ);
  if (state != RADIOLIB_ERR_NONE) {
    Serial.printf("Radio init failed: %d (check SPI/NSS/RST/DIO + antenna)\n", state);
    while (true) delay(1000);
  }
  radio.setSpreadingFactor(AETHER_LORA_SF);
  radio.setBandwidth(AETHER_LORA_BW);
  Serial.println("TX ready — flash esp32-lora-rx on the peer with the same region/SF.");
}

void loop() {
  String msg = "aether#" + String(counter++);
  int state = radio.transmit(msg);
  if (state == RADIOLIB_ERR_NONE) {
    Serial.printf("TX OK: %s\n", msg.c_str());
  } else {
    Serial.printf("TX fail: %d\n", state);
  }
  delay(2000);
}