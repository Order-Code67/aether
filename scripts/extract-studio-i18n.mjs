import fs from "node:fs";

function extractInavBlock(src) {
  const out = {};
  const lines = src.split(/\r?\n/);
  let key = null;
  let buf = [];
  const flush = () => {
    if (!key) return;
    let val = buf.join(" ").trim().replace(/,$/, "");
    out[key] = val;
    key = null;
    buf = [];
  };
  for (const line of lines) {
    const m = line.match(/^\s*"([^"]+)":\s*(.*)$/);
    if (m) {
      flush();
      key = m[1];
      const rest = m[2];
      if (rest.startsWith('"') && /",?\s*$/.test(rest)) {
        out[key] = rest.replace(/,$/, "").trim();
        key = null;
        buf = [];
      } else {
        buf = [rest];
      }
      continue;
    }
    if (key) {
      buf.push(line.trim());
      if (/",?\s*$/.test(line.trim())) flush();
    }
  }
  flush();
  const filtered = {};
  for (const [k, v] of Object.entries(out)) {
    if (k.startsWith("inav.")) filtered[k] = v;
  }
  return filtered;
}

const enKeys = extractInavBlock(
  fs.readFileSync("src/i18n/locales/en.ts", "utf8"),
);
const ruKeys = extractInavBlock(
  fs.readFileSync("src/i18n/locales/ru.ts", "utf8"),
);

const extrasEn = {
  "common.refresh": '"Refresh"',
  "app.name": '"BPLA Studio"',
  "studio.family": '"Firmware"',
  "studio.family.inav": '"iNav"',
  "studio.family.betaflight": '"Betaflight"',
  "studio.family.ardupilot": '"ArduPilot"',
  "studio.boards": '"Boards"',
  "studio.boardsHint":
    '"Targets for the selected firmware family. Flash via DFU when supported."',
  "studio.boardsEmpty": '"No boards match this family."',
  "studio.title": '"BPLA Studio"',
  "studio.subtitle": '"FC configurator — connect through Aether or directly"',
};
const extrasRu = {
  "common.refresh": '"Обновить"',
  "app.name": '"БПЛА-Студия"',
  "studio.family": '"Прошивка"',
  "studio.family.inav": '"iNav"',
  "studio.family.betaflight": '"Betaflight"',
  "studio.family.ardupilot": '"ArduPilot"',
  "studio.boards": '"Платы"',
  "studio.boardsHint":
    '"Цели для выбранного семейства. Прошивка через DFU, если поддерживается."',
  "studio.boardsEmpty": '"Нет плат для этого семейства."',
  "studio.title": '"БПЛА-Студия"',
  "studio.subtitle":
    '"Конфигуратор FC — подключение через Aether или напрямую"',
};

Object.assign(enKeys, extrasEn);
Object.assign(ruKeys, extrasRu);
enKeys["inav.title"] = '"BPLA Studio"';
ruKeys["inav.title"] = '"БПЛА-Студия"';
enKeys["inav.connectAether"] = '"Connect"';
ruKeys["inav.connectAether"] = '"Подключить"';
enKeys["inav.connectThroughAether"] =
  '"Connect the FC here, or launch from Aether with COM handoff."';
ruKeys["inav.connectThroughAether"] =
  '"Подключите FC здесь или запустите из Aether с передачей COM."';

// Ensure ru has every en key
for (const k of Object.keys(enKeys)) {
  if (!(k in ruKeys)) ruKeys[k] = enKeys[k];
}

const enBody = Object.entries(enKeys)
  .map(([k, v]) => `  "${k}": ${v},`)
  .join("\n");
fs.writeFileSync(
  "apps/bpla-studio/src/i18n/locales/en.ts",
  `export const en = {\n${enBody}\n} as const;\n\nexport type MessageKey = keyof typeof en;\n`,
);

const ruBody = Object.keys(enKeys)
  .map((k) => `  "${k}": ${ruKeys[k] ?? enKeys[k]},`)
  .join("\n");
fs.writeFileSync(
  "apps/bpla-studio/src/i18n/locales/ru.ts",
  `import type { MessageKey } from "./en";\n\nexport const ru: Record<MessageKey, string> = {\n${ruBody}\n};\n`,
);

console.log("wrote", Object.keys(enKeys).length, "keys");
