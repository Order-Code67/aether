/*
 * Aether ESP32-CAM (AI-Thinker) — Wi‑Fi + JPEG /capture + MJPEG /stream
 *
 * POWER: Use a stable 5 V supply that can handle camera peak current.
 * Inadequate USB-UART adapter power commonly causes brownouts, failed
 * esp_camera_init, and Wi‑Fi drops. Prefer a dedicated 5 V / ≥1 A supply
 * on the 5V pin (common ground). Brownout detector may reset the chip
 * under load — that is a power issue, not a sketch bug.
 *
 * Upload: GPIO0 → GND for download mode, then reset; monitor @ 115200.
 * PlatformIO board id: esp32cam
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include "esp_camera.h"

// Replace with your network credentials before upload.
static const char *WIFI_SSID = "YOUR_SSID";
static const char *WIFI_PASS = "YOUR_PASSWORD";

// AI-Thinker ESP32-CAM pin map
#define PWDN_GPIO_NUM 32
#define RESET_GPIO_NUM -1
#define XCLK_GPIO_NUM 0
#define SIOD_GPIO_NUM 26
#define SIOC_GPIO_NUM 27
#define Y9_GPIO_NUM 35
#define Y8_GPIO_NUM 34
#define Y7_GPIO_NUM 39
#define Y6_GPIO_NUM 36
#define Y5_GPIO_NUM 21
#define Y4_GPIO_NUM 19
#define Y3_GPIO_NUM 18
#define Y2_GPIO_NUM 5
#define VSYNC_GPIO_NUM 25
#define HREF_GPIO_NUM 23
#define PCLK_GPIO_NUM 22

#ifndef LED_STATUS
#define LED_STATUS 33
#endif

WebServer server(80);

bool initCamera() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.frame_size = FRAMESIZE_QVGA;
  config.jpeg_quality = 12;
  config.fb_count = 1;
  config.fb_location = CAMERA_FB_IN_DRAM;
  config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;

  if (psramFound()) {
    config.frame_size = FRAMESIZE_SVGA;
    config.jpeg_quality = 10;
    config.fb_count = 2;
    config.fb_location = CAMERA_FB_IN_PSRAM;
    config.grab_mode = CAMERA_GRAB_LATEST;
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed: 0x%x\n", err);
    Serial.println(
        "Hint: brownout / weak 5V? Use external 5V supply (not only USB-UART).");
    return false;
  }
  return true;
}

void handleCapture() {
  camera_fb_t *fb = esp_camera_fb_get();
  if (!fb) {
    server.send(503, "text/plain", "Camera capture failed");
    return;
  }
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Cache-Control", "no-store");
  server.sendHeader("Content-Type", "image/jpeg");
  server.sendHeader("Content-Length", String(static_cast<unsigned>(fb->len)));
  server.send(200);
  server.client().write(fb->buf, fb->len);
  esp_camera_fb_return(fb);
}

void handleStream() {
  WiFiClient client = server.client();
  String response = "HTTP/1.1 200 OK\r\n";
  response += "Access-Control-Allow-Origin: *\r\n";
  response += "Content-Type: multipart/x-mixed-replace; boundary=frame\r\n";
  response += "Cache-Control: no-cache, no-store\r\n\r\n";
  client.print(response);

  while (client.connected()) {
    camera_fb_t *fb = esp_camera_fb_get();
    if (!fb) {
      Serial.println("Stream: capture failed");
      break;
    }
    client.printf(
        "--frame\r\nContent-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n",
        static_cast<unsigned>(fb->len));
    client.write(fb->buf, fb->len);
    client.print("\r\n");
    esp_camera_fb_return(fb);
    // Yield so Wi‑Fi stack stays healthy
    delay(1);
    if (!client.connected()) break;
  }
}

void handleRoot() {
  server.send(200, "text/plain",
              "Aether ESP32-CAM\n"
              "GET /capture — JPEG snapshot\n"
              "GET /stream  — MJPEG stream\n"
              "Power: stable 5V required (see README).\n");
}

void setup() {
  pinMode(LED_STATUS, OUTPUT);
  Serial.begin(115200);
  delay(500);
  Serial.println();
  Serial.println("Aether esp32-cam");
  Serial.println("Power: use stable 5V; USB-UART alone often brownouts.");

  if (!initCamera()) {
    Serial.println("Camera failed — check 5V power and AI-Thinker wiring.");
  } else {
    Serial.println("Camera ready");
  }

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
    Serial.println("WiFi connected");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
    // Autofill-compatible lines for Aether Camera panel
    Serial.print("Capture URL: http://");
    Serial.print(WiFi.localIP());
    Serial.println("/capture");
    Serial.print("Stream URL: http://");
    Serial.print(WiFi.localIP());
    Serial.println("/stream");
  } else {
    Serial.println("WiFi not connected — set WIFI_SSID / WIFI_PASS in main.cpp");
  }

  server.on("/", HTTP_GET, handleRoot);
  server.on("/capture", HTTP_GET, handleCapture);
  server.on("/stream", HTTP_GET, handleStream);
  server.begin();
  Serial.println("HTTP server on :80 (/capture, /stream)");
}

void loop() {
  server.handleClient();
  digitalWrite(LED_STATUS, HIGH);
  delay(50);
  digitalWrite(LED_STATUS, LOW);
  delay(950);
}
