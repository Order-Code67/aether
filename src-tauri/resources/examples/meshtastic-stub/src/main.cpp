#include <Arduino.h>

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println("Meshtastic is a separate firmware project.");
  Serial.println("Aether: use LoRa TX/RX examples or flash https://meshtastic.org");
}

void loop() { delay(5000); }