import type { ExtensionManifest } from "@/types/extensions";

/** Curated built-in extensions (always available; enable/disable in UI). */
export const BUILTIN_EXTENSIONS: ExtensionManifest[] = [
  {
    id: "aether.arduino-snippets",
    name: "Arduino Snippets",
    version: "1.0.0",
    description:
      "Common Arduino / Wiring snippets: setup/loop, digitalWrite, Serial, millis.",
    publisher: "Aether",
    category: "snippets",
    source: "builtin",
    contributes: {
      languages: ["cpp", "c"],
      snippets: [
        {
          label: "setup",
          insertText:
            "void setup() {\n\t$0\n}\n\nvoid loop() {\n\t\n}\n",
          detail: "Arduino setup + loop",
          documentation: "Standard Arduino sketch entry points.",
        },
        {
          label: "serialbegin",
          insertText: "Serial.begin(${1:115200});",
          detail: "Serial.begin",
        },
        {
          label: "digitalwrite",
          insertText: "digitalWrite(${1:LED_BUILTIN}, ${2|HIGH,LOW|});",
          detail: "digitalWrite",
        },
        {
          label: "pinmode",
          insertText: "pinMode(${1:pin}, ${2|INPUT,OUTPUT,INPUT_PULLUP|});",
          detail: "pinMode",
        },
        {
          label: "millis",
          insertText:
            "unsigned long ${1:now} = millis();\nif (${1:now} - ${2:last} >= ${3:1000}) {\n\t${2:last} = ${1:now};\n\t$0\n}",
          detail: "Non-blocking millis timer",
        },
      ],
    },
  },
  {
    id: "aether.esp32-snippets",
    name: "ESP32 Snippets",
    version: "1.0.0",
    description:
      "ESP32 helpers: WiFi begin, FreeRTOS task, preferences, deep sleep.",
    publisher: "Aether",
    category: "snippets",
    source: "builtin",
    contributes: {
      languages: ["cpp", "c"],
      snippets: [
        {
          label: "wifibegin",
          insertText:
            'WiFi.mode(WIFI_STA);\nWiFi.begin("${1:ssid}", "${2:password}");\nwhile (WiFi.status() != WL_CONNECTED) {\n\tdelay(200);\n}\n',
          detail: "WiFi STA connect",
        },
        {
          label: "xTaskCreate",
          insertText:
            "xTaskCreate(\n\t${1:taskFn},\n\t\"${2:task}\",\n\t${3:4096},\n\tNULL,\n\t${4:1},\n\tNULL\n);",
          detail: "FreeRTOS xTaskCreate",
        },
        {
          label: "prefs",
          insertText:
            'Preferences ${1:prefs};\n${1:prefs}.begin("${2:app}", false);\n${1:prefs}.putString("${3:key}", "${4:value}");\n${1:prefs}.end();',
          detail: "Preferences NVS",
        },
      ],
    },
  },
  {
    id: "aether.drone-snippets",
    name: "Drone / MAVLink Snippets",
    version: "1.0.0",
    description:
      "Lightweight snippets for drone firmware: arming guard, RC channel map, failsafe stub.",
    publisher: "Aether",
    category: "snippets",
    source: "builtin",
    contributes: {
      languages: ["cpp", "c"],
      snippets: [
        {
          label: "armguard",
          insertText:
            "if (!${1:armed}) {\n\tsetMotorOutputs(0, 0, 0, 0);\n\treturn;\n}\n$0",
          detail: "Disarm motor cutout",
        },
        {
          label: "rcmap",
          insertText:
            "float ${1:roll} = mapRc(${2:channels}[${3:0}], ${4:1000}, ${5:2000}, -1.0f, 1.0f);\nfloat ${6:pitch} = mapRc(${2:channels}[${7:1}], ${4:1000}, ${5:2000}, -1.0f, 1.0f);\nfloat ${8:yaw} = mapRc(${2:channels}[${9:3}], ${4:1000}, ${5:2000}, -1.0f, 1.0f);\nfloat ${10:throttle} = mapRc(${2:channels}[${11:2}], ${4:1000}, ${5:2000}, 0.0f, 1.0f);",
          detail: "Map RC channels",
        },
        {
          label: "failsafe",
          insertText:
            "if (${1:linkLost}) {\n\t// failsafe: hold / RTL / disarm\n\t${2:enterFailsafe}();\n\treturn;\n}\n$0",
          detail: "Link-loss failsafe stub",
        },
      ],
    },
  },
  {
    id: "aether.extra-boards",
    name: "Extra Board Presets",
    version: "1.0.0",
    description:
      "Additional PlatformIO board ids for New Project (STM32, nRF52, RP2040 variants).",
    publisher: "Aether",
    category: "boards",
    source: "builtin",
    contributes: {
      boards: [
        { id: "blackpill_f411ce", label: "STM32 BlackPill F411" },
        { id: "bluepill_f103c8", label: "STM32 BluePill F103" },
        { id: "adafruit_feather_nrf52840", label: "Feather nRF52840" },
        { id: "pico", label: "Raspberry Pi Pico" },
        { id: "seeed_xiao_rp2040", label: "Seeed XIAO RP2040" },
        { id: "esp32-c3-devkitm-1", label: "ESP32-C3 DevKitM" },
      ],
    },
  },
  {
    id: "aether.pio-ini-snippets",
    name: "platformio.ini Snippets",
    version: "1.0.0",
    description: "Snippets for platformio.ini: env blocks, lib_deps, monitor.",
    publisher: "Aether",
    category: "snippets",
    source: "builtin",
    contributes: {
      languages: ["ini"],
      snippets: [
        {
          label: "env",
          insertText:
            "[env:${1:myenv}]\nplatform = ${2:espressif32}\nboard = ${3:esp32dev}\nframework = ${4:arduino}\nmonitor_speed = ${5:115200}\n",
          detail: "New [env:] block",
        },
        {
          label: "lib_deps",
          insertText: "lib_deps =\n\t${1:bblanchon/ArduinoJson @ ^7.0.0}\n",
          detail: "lib_deps",
        },
        {
          label: "build_flags",
          insertText: "build_flags =\n\t-D${1:CORE_DEBUG_LEVEL}=${2:3}\n",
          detail: "build_flags",
        },
      ],
    },
  },
];

export const DEFAULT_ENABLED_EXTENSIONS = BUILTIN_EXTENSIONS.map((e) => e.id);
