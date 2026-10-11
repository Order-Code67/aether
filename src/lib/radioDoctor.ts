import { resolveLoraPinMap } from "@/lib/hardwarePinMaps";

export interface RadioDoctorHints {
  /** Project looks like a LoRa / radio sketch */
  isRadioProject: boolean;
  tipsEn: string[];
  tipsRu: string[];
}

const LORA_MARKERS =
  /radiolib|\bsandeepmistry\/lora\b|\blora\b|lmic|sx127|sx126|rfm9|heltec|ttgo-lora|t-beam/i;

/** Inspect platformio.ini text + selected env for radio wiring tips. */
export function analyzeRadioProject(
  iniText: string | null | undefined,
  selectedEnv: string | null | undefined,
): RadioDoctorHints {
  const ini = iniText ?? "";
  const env = selectedEnv ?? "";
  const pinMap = resolveLoraPinMap(env);
  const isRadio =
    Boolean(pinMap) ||
    LORA_MARKERS.test(ini) ||
    LORA_MARKERS.test(env);

  if (!isRadio) {
    return { isRadioProject: false, tipsEn: [], tipsRu: [] };
  }

  const tipsEn: string[] = [
    "Radio init fail: check NSS / DIO / RST / BUSY match your board env (see pin map in example).",
    "SPI: confirm SCK/MISO/MOSI; Heltec V3 uses different pins than V2 / TTGO.",
    "OLED blank: verify SDA/SCL (and OLED RST on Heltec); try U8g2 or Adafruit SSD1306.",
    "Silent air: TX and RX must share region (EU868 / US915 / RU864), SF, and bandwidth.",
    "Antenna attached before TX. Wrong frequency region is a common “no packets” cause.",
  ];
  const tipsRu: string[] = [
    "Ошибка init радио: проверьте NSS / DIO / RST / BUSY под выбранный env (карта пинов в примере).",
    "SPI: сверьте SCK/MISO/MOSI; у Heltec V3 пины другие, чем у V2 / TTGO.",
    "OLED пустой: SDA/SCL (и RST OLED на Heltec); попробуйте U8g2 или Adafruit SSD1306.",
    "«Эфир молчит»: TX и RX — один регион (EU868 / US915 / RU864), SF и полоса.",
    "Антенна до TX. Неверный регион частоты — частая причина отсутствия пакетов.",
  ];

  if (pinMap) {
    tipsEn.unshift(
      `Pin map (${pinMap.label}): NSS=${pinMap.nss} DIO=${pinMap.dio} RST=${pinMap.rst} BUSY=${pinMap.busy}; OLED SDA=${pinMap.oledSda ?? "—"} SCL=${pinMap.oledScl ?? "—"}.`,
    );
    tipsRu.unshift(
      `Карта пинов (${pinMap.label}): NSS=${pinMap.nss} DIO=${pinMap.dio} RST=${pinMap.rst} BUSY=${pinMap.busy}; OLED SDA=${pinMap.oledSda ?? "—"} SCL=${pinMap.oledScl ?? "—"}.`,
    );
  }

  return { isRadioProject: true, tipsEn, tipsRu };
}
