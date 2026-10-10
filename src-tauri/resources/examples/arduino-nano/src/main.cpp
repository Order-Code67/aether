#include <Arduino.h>
#include <Servo.h>

#ifndef LED_BUILTIN
#define LED_BUILTIN 13
#endif

#ifndef SERVO_PIN
#define SERVO_PIN 9
#endif

Servo servo;

void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.begin(115200);
  servo.attach(SERVO_PIN);
  servo.write(90);
  Serial.println("Aether arduino-nano ready");
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  delay(500);
  digitalWrite(LED_BUILTIN, LOW);
  delay(500);
}
