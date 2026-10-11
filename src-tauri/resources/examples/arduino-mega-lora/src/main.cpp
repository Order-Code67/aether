#include <Arduino.h>
#include <RadioLib.h>

#ifndef AETHER_LORA_NSS
#define AETHER_LORA_NSS 10
#endif
#ifndef AETHER_LORA_DIO
#define AETHER_LORA_DIO 2
#endif
#ifndef AETHER_LORA_RST
#define AETHER_LORA_RST 9
#endif
#ifndef AETHER_LORA_BUSY
#define AETHER_LORA_BUSY -1
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

SX1276 radio = new Module(AETHER_LORA_NSS, AETHER_LORA_DIO, AETHER_LORA_RST, AETHER_LORA_BUSY);
uint32_t counter = 0;
bool transmitMode = true;

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println(F("Aether Mega LoRa (RFM95/SX1276)"));
  Serial.println(F("Wiring: NSS=10 DIO0=2 RST=9, SPI 50/51/52"));
  int state = radio.begin(AETHER_LORA_FREQ);
  if (state != RADIOLIB_ERR_NONE) {
    Serial.print(F("Radio init failed: "));
    Serial.println(state);
    while (true) delay(1000);
  }
  radio.setSpreadingFactor(AETHER_LORA_SF);
  radio.setBandwidth(AETHER_LORA_BW);
  Serial.println(F("Ready. Sends aether#N every 2s; also prints RX."));
}

void loop() {
  if (transmitMode) {
    String msg = String("aether#") + String(counter++);
    int state = radio.transmit(msg);
    Serial.print(state == RADIOLIB_ERR_NONE ? F("TX OK: ") : F("TX fail: "));
    if (state == RADIOLIB_ERR_NONE) Serial.println(msg);
    else Serial.println(state);
  }
  String str;
  int state = radio.receive(str);
  if (state == RADIOLIB_ERR_NONE) {
    Serial.print(F("RX: "));
    Serial.println(str);
  }
  delay(2000);
}