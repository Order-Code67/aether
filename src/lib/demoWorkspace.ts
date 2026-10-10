import type { EditorLanguage } from "@/types/editor";
import { languageFromPath } from "@/types/editor";

export interface DemoFile {
  path: string;
  content: string;
  language?: EditorLanguage;
}

export type DemoTreeNode =
  | { path: string; kind: "folder"; children: DemoTreeNode[] }
  | { path: string; kind: "file" };

export const DEMO_FILES: DemoFile[] = [
  {
    path: "src/main.ino",
    content: `// Aether demo — blink sketch for Arduino / ESP32
#include <Arduino.h>

#ifndef LED_BUILTIN
#define LED_BUILTIN 2
#endif

void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.begin(115200);
  Serial.println("Aether ready");
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  delay(500);
  digitalWrite(LED_BUILTIN, LOW);
  delay(500);
}
`,
  },
  {
    path: "platformio.ini",
    language: "ini",
    content: `; PlatformIO Project Configuration File
[env:esp32dev]
platform = espressif32
board = esp32dev
framework = arduino
monitor_speed = 115200
`,
  },
  {
    path: "README.md",
    content: `# Demo Workspace

Sample embedded project for the Aether IDE shell.

Open files from the Explorer sidebar to edit them in Monaco.
`,
  },
];

export const DEMO_TREE: DemoTreeNode[] = [
  {
    path: "src",
    kind: "folder",
    children: [{ path: "src/main.ino", kind: "file" }],
  },
  { path: "platformio.ini", kind: "file" },
  { path: "README.md", kind: "file" },
];

export function resolveDemoFile(path: string): DemoFile | undefined {
  const file = DEMO_FILES.find((item) => item.path === path);
  if (!file) return undefined;
  return {
    ...file,
    language: file.language ?? languageFromPath(file.path),
  };
}
