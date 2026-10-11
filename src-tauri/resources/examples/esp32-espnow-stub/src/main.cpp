#include <Arduino.h>
#include <WiFi.h>
#include <esp_now.h>
#include <ArduinoJson.h>

// ESP-NOW peer stub — set PEER_MAC to the other board STA MAC (Serial prints ours).

uint8_t PEER_MAC[6] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

void onRecv(const uint8_t *mac, const uint8_t *data, int len) {
  Serial.printf("ESP-NOW RX %d bytes from %02X:%02X:%02X:%02X:%02X:%02X\n",
                len, mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
  Serial.write(data, len);
  Serial.println();
}

void setup() {
  Serial.begin(115200);
  delay(200);
  WiFi.mode(WIFI_STA);
  Serial.print("This MAC: ");
  Serial.println(WiFi.macAddress());

  if (esp_now_init() != ESP_OK) {
    Serial.println("esp_now_init failed");
    return;
  }
  esp_now_register_recv_cb(onRecv);

  esp_now_peer_info_t peer{};
  memcpy(peer.peer_addr, PEER_MAC, 6);
  peer.channel = 0;
  peer.encrypt = false;
  if (esp_now_add_peer(&peer) != ESP_OK) {
    Serial.println("add_peer failed — set PEER_MAC");
  }

  Serial.println("ESP-NOW ready (broadcast peer FF:FF:… until you set a MAC)");
}

void loop() {
  JsonDocument doc;
  doc["from"] = "aether";
  doc["ms"] = millis();
  char buf[128];
  size_t n = serializeJson(doc, buf, sizeof(buf));
  esp_err_t e = esp_now_send(PEER_MAC, reinterpret_cast<uint8_t *>(buf), n);
  Serial.printf("TX %s (%u bytes)\n", e == ESP_OK ? "ok" : "fail", (unsigned)n);
  delay(2000);
}