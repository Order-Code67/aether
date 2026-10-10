#include <Arduino.h>
#include <WiFi.h>

// Replace with your network credentials before upload.
static const char *WIFI_SSID = "YOUR_SSID";
static const char *WIFI_PASS = "YOUR_PASSWORD";

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println();
  Serial.println("Aether esp32-wifi stub");

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.printf("Connecting to %s", WIFI_SSID);

  uint8_t attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500);
    Serial.print('.');
    attempts++;
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("Connected. IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("Not connected — check SSID/password, or see:");
    Serial.println("https://docs.platformio.org/en/latest/platforms/espressif32.html");
  }
}

void loop() {
  delay(2000);
}
