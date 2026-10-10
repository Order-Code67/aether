#include <Arduino.h>

#ifndef LED_BUILTIN
#define LED_BUILTIN 2
#endif

void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.begin(115200);
  Serial.println("Aether esp32-blink ready");
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  delay(500);
  digitalWrite(LED_BUILTIN, LOW);
  delay(500);
}
