// Smart Silo Monitoring System - ESP32 firmware
//
// Reads a DHT11 (air temperature / humidity) and an analog water/level sensor and posts
// temperature + humidity to POST {API_BASE_URL}/readings/hardware with the X-Device-Key header.
//
// The backend schema (HardwareReadingCreate) accepts: silo_id, temperature_c, humidity_percent,
// and optional grain_moisture_percent / recorded_at. It has no water-level field, so the
// water sensor is shown on the serial monitor only (see README "Known gaps").
//
// Setup: copy secrets.example.h to secrets.h and fill it in. Library: "DHT sensor library" (Adafruit).

#include <DHT.h>
#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>

#include "secrets.h"

// ---- Hardware -------------------------------------------------------------
#define DHT_PIN 4
#define DHT_TYPE DHT11
const int WATER_SENSOR_PIN = 34;  // ADC1 pin: ADC2 cannot be used while Wi-Fi is active.

// ---- Timing ---------------------------------------------------------------
const unsigned long SENSOR_INTERVAL_MS = 2000;    // DHT11 allows at most 1 read per second.
const unsigned long POST_INTERVAL_MS = 300000;    // 5 min. The dashboard treats a device as online for 15 min.
const unsigned long WIFI_TIMEOUT_MS = 15000;
const unsigned long WIFI_RETRY_COOLDOWN_MS = 15000;
const unsigned long HTTP_TIMEOUT_MS = 60000;      // Render's free tier can take ~50 s to wake from sleep.

// ---- Water sensor thresholds (raw 12-bit ADC, 0-4095) ----------------------
// Uncalibrated placeholders. Measure your sensor dry / in water and adjust.
const int WATER_EMPTY_MAX = 400;
const int WATER_LOW_MAX = 1800;
const int WATER_MEDIUM_MAX = 2200;

DHT dht(DHT_PIN, DHT_TYPE);

unsigned long lastSensorAt = 0;
unsigned long lastPostAt = 0;
unsigned long lastWifiAttemptAt = 0;
bool hasPosted = false;
bool hasAttemptedWifi = false;

float lastTemperature = NAN;
float lastHumidity = NAN;

bool connectToWiFi() {
  if (WiFi.status() == WL_CONNECTED) return true;

  // Throttle reconnects so a dead network does not block the loop for 15 s on every pass.
  if (hasAttemptedWifi && millis() - lastWifiAttemptAt < WIFI_RETRY_COOLDOWN_MS) return false;
  hasAttemptedWifi = true;
  lastWifiAttemptAt = millis();

  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("Connecting to Wi-Fi");
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < WIFI_TIMEOUT_MS) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("Connected. IP: ");
    Serial.println(WiFi.localIP());
    return true;
  }
  Serial.println("Wi-Fi connection failed.");
  return false;
}

int readWaterAveraged() {
  long sum = 0;
  const int samples = 16;
  for (int i = 0; i < samples; i++) {
    sum += analogRead(WATER_SENSOR_PIN);
    delay(2);
  }
  return (int)(sum / samples);
}

const char *waterLabel(int raw) {
  if (raw <= WATER_EMPTY_MAX) return "Empty";
  if (raw <= WATER_LOW_MAX) return "Low";
  if (raw <= WATER_MEDIUM_MAX) return "Medium";
  return "High";
}

bool uploadReading(float temperature, float humidity) {
  if (WiFi.status() != WL_CONNECTED) return false;

  WiFiClientSecure client;
#ifdef API_ROOT_CA
  client.setCACert(API_ROOT_CA);
#else
  client.setInsecure();  // No certificate validation: set API_ROOT_CA in secrets.h for production.
#endif

  HTTPClient http;
  String url = String(API_BASE_URL) + "/readings/hardware";
  if (!http.begin(client, url)) {
    Serial.println("Unable to initialise HTTP client.");
    return false;
  }
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", DEVICE_API_KEY);

  char payload[128];
  snprintf(payload, sizeof(payload),
           "{\"silo_id\":%d,\"temperature_c\":%.2f,\"humidity_percent\":%.2f}",
           SILO_ID, temperature, humidity);

  int code = http.POST((uint8_t *)payload, strlen(payload));
  Serial.printf("API response: %d\n", code);

  bool ok = code >= 200 && code < 300;
  if (!ok) {
    // code < 0 is an HTTPClient transport error (timeout, TLS, DNS); there is no body to read.
    if (code > 0) Serial.println(http.getString());
    else Serial.println(HTTPClient::errorToString(code));
  }
  http.end();
  return ok;
}

void setup() {
  Serial.begin(115200);
  analogReadResolution(12);
  analogSetPinAttenuation(WATER_SENSOR_PIN, ADC_11db);  // Full 0-3.3 V range.
  dht.begin();
#ifndef API_ROOT_CA
  Serial.println("WARNING: API_ROOT_CA not set; TLS certificates are NOT verified.");
#endif
  connectToWiFi();
}

void loop() {
  connectToWiFi();

  if (lastSensorAt == 0 || millis() - lastSensorAt >= SENSOR_INTERVAL_MS) {
    lastSensorAt = millis();

    float temperature = dht.readTemperature();
    float humidity = dht.readHumidity();
    int water = readWaterAveraged();

    Serial.printf("Water raw: %d (%s)\n", water, waterLabel(water));

    if (isnan(temperature) || isnan(humidity)) {
      Serial.println("DHT sensor read failed.");
    } else {
      lastTemperature = temperature;
      lastHumidity = humidity;
      Serial.printf("Temperature: %.1f C  Humidity: %.1f %%\n", temperature, humidity);
    }
    Serial.println("------------------------------------");
  }

  // Post the most recent valid DHT values, so one failed read does not skip a whole interval.
  bool haveReading = !isnan(lastTemperature) && !isnan(lastHumidity);
  bool due = !hasPosted || millis() - lastPostAt >= POST_INTERVAL_MS;
  if (haveReading && due && WiFi.status() == WL_CONNECTED) {
    if (uploadReading(lastTemperature, lastHumidity)) {
      Serial.println("Reading uploaded.");
      lastPostAt = millis();
      hasPosted = true;
    } else {
      Serial.println("Upload failed; will retry.");
      // Back off so a failing server is not hit every loop iteration.
      lastPostAt = millis() - POST_INTERVAL_MS + 30000;
      hasPosted = true;
    }
  }

  delay(50);
}
