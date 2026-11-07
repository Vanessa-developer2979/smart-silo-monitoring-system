// Copy this file to secrets.h (same folder) and fill in your values.
// secrets.h is git-ignored. Never commit real credentials.
#pragma once

#define WIFI_SSID        "Nessava"
#define WIFI_PASSWORD    "Vanessap"

// Base URL of the deployed API including /api, no trailing slash.
// Example: "https://smart-silo-api.onrender.com/api"
#define API_BASE_URL     "https://smart-silo-api-jwo0.onrender.com"

// Must equal ESP32_API_KEY configured on the backend.
#define DEVICE_API_KEY   "FLax43okQ8bgkOCBh1rJINywfAj4DsXVb2xkN5_V1sxTW-I7jbd_ebGeNhmSCUOf"

// ID of the silo (from the dashboard / GET /api/silos/) this device reports for.
#define SILO_ID          1

// Optional but recommended: PEM root certificate of your API host.
// Without it the device skips TLS verification and logs a warning at boot.
#define API_ROOT_CA "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----\n"