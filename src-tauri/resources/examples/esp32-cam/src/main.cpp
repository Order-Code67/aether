#include <Arduino.h>

// AI-Thinker ESP32-CAM onboard LED (GPIO 33 is status LED on many modules;
// flash LED is GPIO 4 — keep this blink simple without camera init).
#ifndef LED_STATUS
#define LED_STATUS 33
#endif

void setup() {
  pinMode(LED_STATUS, OUTPUT);
  Serial.begin(115200);
  delay(500);
  Serial.println("Aether esp32-cam ready");
  Serial.println("temp:20.0 humidity:50");
}

void loop() {
  static float temp = 20.0f;
  temp += 0.1f;
  if (temp > 30.0f) temp = 20.0f;
  Serial.print("temp:");
  Serial.print(temp, 1);
  Serial.print(" humidity:");
  Serial.println(55.0f + (temp - 20.0f), 1);

  digitalWrite(LED_STATUS, HIGH);
  delay(250);
  digitalWrite(LED_STATUS, LOW);
  delay(750);
}
