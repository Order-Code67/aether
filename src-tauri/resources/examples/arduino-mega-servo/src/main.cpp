#include <Arduino.h>
#include <Servo.h>
#include <ArduinoJson.h>

#ifndef SERVO_PIN
#define SERVO_PIN 9
#endif

Servo servo;

void setup() {
  Serial.begin(115200);
  servo.attach(SERVO_PIN);
  servo.write(90);

  JsonDocument doc;
  doc["board"] = "megaatmega2560";
  doc["servo_pin"] = SERVO_PIN;
  doc["angle"] = 90;
  serializeJson(doc, Serial);
  Serial.println();
  Serial.println("Aether arduino-mega-servo ready");
}

void loop() {
  static int angle = 0;
  static int step = 1;

  servo.write(angle);
  angle += step;
  if (angle >= 180 || angle <= 0) {
    step = -step;
  }
  delay(20);
}
