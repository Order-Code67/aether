import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Download,
  GitBranch,
  Library,
  Loader2,
  RefreshCw,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { cn } from "@/lib/cn";
import { errorMessage } from "@/lib/errors";
import { parseGithubLibSpec } from "@/lib/githubLibSpec";
import { friendlyPioError } from "@/lib/pioErrors";
import {
  ARDUINO_CLI_DOCS_URL,
  detectArduinoCli,
  installArduinoCliLibrary,
  listArduinoCliLibFolders,
  searchArduinoCliLibraries,
  type ArduinoCliInfo,
} from "@/lib/arduinoCli";
import { stacksForPlatform } from "@/lib/libraryStacks";
import {
  installPioLibrary,
  listPioLibraries,
  searchPioLibraries,
  uninstallPioLibrary,
  type PioLibEntry,
} from "@/lib/platformio";
import { isTauriRuntime } from "@/lib/tauri";
import { useLibrariesPrefsStore } from "@/stores/librariesPrefsStore";
import { isAppOffline } from "@/stores/offlineStore";
import { usePlatformIoStore } from "@/stores/platformioStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

type PlatformPreset = "all" | "arduino" | "esp32" | "nano" | "mega";

interface PlatformChip {
  id: PlatformPreset;
  labelKey:
    | "libraries.chipAll"
    | "libraries.chipArduino"
    | "libraries.chipEsp32"
    | "libraries.chipNano"
    | "libraries.chipMega";
  /** PlatformIO `--platform` filter */
  platform: string | null;
  /** PlatformIO `--framework` filter (e.g. arduino across all platforms) */
  framework: string | null;
}

const PLATFORM_CHIPS: PlatformChip[] = [
  {
    id: "all",
    labelKey: "libraries.chipAll",
    platform: null,
    framework: null,
  },
  {
    id: "arduino",
    labelKey: "libraries.chipArduino",
    platform: null,
    framework: "arduino",
  },
  {
    id: "esp32",
    labelKey: "libraries.chipEsp32",
    platform: "espressif32",
    framework: "arduino",
  },
  {
    id: "nano",
    labelKey: "libraries.chipNano",
    platform: "atmelavr",
    framework: "arduino",
  },
  {
    id: "mega",
    labelKey: "libraries.chipMega",
    platform: "atmelavr",
    framework: "arduino",
  },
];

function chipHasFilter(chip: PlatformChip): boolean {
  return Boolean(chip.platform || chip.framework);
}

/** Curated popular registry specs (owner/name) — installed via real `pio pkg install`. */
const POPULAR: Record<PlatformPreset, { spec: string; label: string }[]> = {
  all: [
    { spec: "bblanchon/ArduinoJson", label: "ArduinoJson" },
    { spec: "adafruit/Adafruit NeoPixel", label: "NeoPixel" },
    { spec: "fastled/FastLED", label: "FastLED" },
    { spec: "olikraus/U8g2", label: "U8g2" },
    { spec: "knolleary/PubSubClient", label: "PubSubClient" },
    { spec: "milesburton/DallasTemperature", label: "DallasTemp" },
    { spec: "paulstoffregen/OneWire", label: "OneWire" },
    { spec: "adafruit/Adafruit SSD1306", label: "SSD1306" },
  ],
  arduino: [
    { spec: "bblanchon/ArduinoJson", label: "ArduinoJson" },
    { spec: "adafruit/Adafruit NeoPixel", label: "NeoPixel" },
    { spec: "fastled/FastLED", label: "FastLED" },
    { spec: "olikraus/U8g2", label: "U8g2" },
    { spec: "knolleary/PubSubClient", label: "PubSubClient" },
    { spec: "milesburton/DallasTemperature", label: "DallasTemp" },
    { spec: "paulstoffregen/OneWire", label: "OneWire" },
    { spec: "arduino-libraries/Servo", label: "Servo" },
  ],
  esp32: [
    { spec: "bblanchon/ArduinoJson", label: "ArduinoJson" },
    { spec: "knolleary/PubSubClient", label: "PubSubClient" },
    { spec: "esp32async/ESPAsyncWebServer", label: "ESPAsyncWebServer" },
    { spec: "esp32async/AsyncTCP", label: "AsyncTCP" },
    { spec: "tzapu/WiFiManager", label: "WiFiManager" },
    { spec: "fastled/FastLED", label: "FastLED" },
    { spec: "adafruit/Adafruit NeoPixel", label: "NeoPixel" },
    { spec: "olikraus/U8g2", label: "U8g2" },
    { spec: "madhephaestus/ESP32Servo", label: "ESP32Servo" },
  ],
  nano: [
    { spec: "bblanchon/ArduinoJson", label: "ArduinoJson" },
    { spec: "adafruit/Adafruit NeoPixel", label: "NeoPixel" },
    { spec: "adafruit/Adafruit SSD1306", label: "SSD1306" },
    { spec: "adafruit/Adafruit BusIO", label: "BusIO" },
    { spec: "olikraus/U8g2", label: "U8g2" },
    { spec: "milesburton/DallasTemperature", label: "DallasTemp" },
    { spec: "paulstoffregen/OneWire", label: "OneWire" },
    { spec: "arduino-libraries/Servo", label: "Servo" },
  ],
  mega: [
    { spec: "bblanchon/ArduinoJson", label: "ArduinoJson" },
    { spec: "adafruit/Adafruit GFX Library", label: "Adafruit GFX" },
    { spec: "adafruit/Adafruit SSD1306", label: "SSD1306" },
    { spec: "adafruit/Adafruit NeoPixel", label: "NeoPixel" },
    { spec: "olikraus/U8g2", label: "U8g2" },
    { spec: "fastled/FastLED", label: "FastLED" },
    { spec: "milesburton/DallasTemperature", label: "DallasTemp" },
    { spec: "arduino-libraries/Servo", label: "Servo" },
  ],
};

const ESP32_SERVO_SPEC = "madhephaestus/ESP32Servo";

function depMatches(dep: string, needle: string): boolean {
  const d = dep.toLowerCase();
  const n = needle.toLowerCase();
  if (!n) return false;
  const bare = (d.split("@")[0] ?? d).trim();
  return (
    d === n ||
    d.includes(n) ||
    d.endsWith(`/${n}`) ||
    bare === n ||
    bare.endsWith(`/${n}`)
  );
}

function entrySpec(entry: PioLibEntry): string {
  return entry.owner ? `${entry.owner}/${entry.name}` : entry.name;
}

type LibManagerTab = "platformio" | "arduino" | "github";

export function LibrariesPanel() {
  const { t } = useI18n();
  const locale = useSettingsStore((s) => s.locale);
  const rootPath = useWorkspaceStore((s) => s.rootPath);
  const isProject = usePlatformIoStore((s) => s.isProject);
  const selectedEnv = usePlatformIoStore((s) => s.selectedEnv);
  const pioInfo = usePlatformIoStore((s) => s.info);
  const favorites = useLibrariesPrefsStore((s) => s.favorites);
  const recent = useLibrariesPrefsStore((s) => s.recent);
  const toggleFavorite = useLibrariesPrefsStore((s) => s.toggleFavorite);
  const isFavorite = useLibrariesPrefsStore((s) => s.isFavorite);
  const pushRecent = useLibrariesPrefsStore((s) => s.pushRecent);
  const [managerTab, setManagerTab] = useState<LibManagerTab>("platformio");
  const [query, setQuery] = useState("");
  const [githubInput, setGithubInput] = useState("");
  const [preset, setPreset] = useState<PlatformPreset>("all");
  const [results, setResults] = useState<PioLibEntry[]>([]);
  const [installed, setInstalled] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [installStatus, setInstallStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [arduinoCli, setArduinoCli] = useState<ArduinoCliInfo | null>(null);

  const effectivePreset: PlatformPreset =
    managerTab === "arduino" ? "arduino" : preset;
  const useArduinoCli =
    managerTab === "arduino" && Boolean(arduinoCli?.installed);

  const chip: PlatformChip = useMemo(() => {
    return (
      PLATFORM_CHIPS.find((c) => c.id === effectivePreset) ?? PLATFORM_CHIPS[0]!
    );
  }, [effectivePreset]);

  const popular = POPULAR[effectivePreset];
  const stacks = stacksForPlatform(effectivePreset);

  const isEsp32Context =
    preset === "esp32" || /esp32/i.test(selectedEnv || "");
  const showServoHint =
    isEsp32Context && /servo/i.test(query.trim());

  const mapLibError = useCallback(
    (err: unknown) => {
      const raw = errorMessage(err, t("common.error"));
      return friendlyPioError(raw, locale);
    },
    [t, locale],
  );

  const refreshInstalled = useCallback(async () => {
    if (!rootPath || !isProject || !isTauriRuntime()) {
      setInstalled([]);
      return;
    }
    try {
      const list = await listPioLibraries(rootPath);
      let merged = list;
      try {
        const libFolders = await listArduinoCliLibFolders(rootPath);
        const set = new Set(merged);
        for (const name of libFolders) {
          if (!set.has(name)) {
            merged = [...merged, name];
            set.add(name);
          }
        }
      } catch {
        // lib/ scan is best-effort
      }
      setInstalled(merged);
    } catch (err) {
      setError(mapLibError(err));
    }
  }, [rootPath, isProject, mapLibError]);

  useEffect(() => {
    void refreshInstalled();
  }, [refreshInstalled]);

  useEffect(() => {
    if (managerTab !== "arduino" || !isTauriRuntime()) {
      return;
    }
    void detectArduinoCli()
      .then(setArduinoCli)
      .catch(() =>
        setArduinoCli({ installed: false, path: null, version: null }),
      );
  }, [managerTab]);

  const runSearch = useCallback(
    async (overrideQuery?: string) => {
      const q = (overrideQuery ?? query).trim();
      if (!q && !chipHasFilter(chip) && !useArduinoCli) {
        setResults([]);
        setHasSearched(false);
        return;
      }
      if (!q && useArduinoCli) {
        setResults([]);
        setHasSearched(false);
        return;
      }
      if (!isTauriRuntime()) {
        setError(t("libraries.needDesktop"));
        return;
      }
      if (isAppOffline()) {
        setResults([]);
        setHasSearched(true);
        setLoading(false);
        setError(t("libraries.offline"));
        return;
      }
      setLoading(true);
      setError(null);
      setHasSearched(true);
      try {
        if (useArduinoCli) {
          const entries = await searchArduinoCliLibraries(q);
          setResults(entries);
        } else {
          if (pioInfo && !pioInfo.installed) {
            setError(t("libraries.pioMissing"));
            setResults([]);
            return;
          }
          const entries = await searchPioLibraries({
            query: q,
            platform: chip.platform,
            framework: chip.framework,
            pages: 2,
          });
          setResults(entries);
        }
      } catch (err) {
        setResults([]);
        setError(mapLibError(err));
      } finally {
        setLoading(false);
      }
    },
    [query, chip, t, pioInfo, mapLibError, useArduinoCli],
  );

  /** Chip/preset only filters local UI — registry search waits for Search click. */
  const selectPreset = (id: PlatformPreset) => {
    setPreset(id);
    setError(null);
    setResults([]);
    setHasSearched(false);
  };

  const install = async (
    library: string,
    busyKey: string,
    options?: { git?: boolean; displayName?: string },
  ) => {
    if (!isTauriRuntime()) {
      setError(t("libraries.needDesktop"));
      return;
    }
    if (!rootPath || !isProject) {
      setError(t("libraries.needProject"));
      return;
    }
    if (isAppOffline()) {
      setError(t("libraries.offline"));
      return;
    }
    const display = options?.displayName ?? library;
    const bareName = library.includes("/")
      ? library.split("/").pop()!.replace(/\.git(#.*)?$/i, "")
      : library;
    const preferArduinoCli =
      useArduinoCli && !options?.git && !/^https?:\/\//i.test(library);

    setBusyId(busyKey);
    setError(null);
    setInstallStatus(
      options?.git
        ? t("libraries.githubProgress", { name: display })
        : preferArduinoCli
          ? t("libraries.arduinoCliInstallProgress", { name: display })
          : t("libraries.installProgress", { name: display }),
    );
    try {
      if (preferArduinoCli) {
        await installArduinoCliLibrary(rootPath, bareName);
      } else {
        await installPioLibrary(rootPath, library, selectedEnv || null);
      }
      pushRecent(library);
      setInstallStatus(t("libraries.installDone", { name: display }));
      await refreshInstalled();
    } catch (err) {
      // Registry fallback: owner/name → bare name (not for git URLs).
      const isGit = options?.git || /^https?:\/\//i.test(library);
      if (!preferArduinoCli && !isGit && bareName !== library) {
        try {
          setInstallStatus(t("libraries.installProgress", { name: bareName }));
          await installPioLibrary(rootPath, bareName, selectedEnv || null);
          pushRecent(library);
          setInstallStatus(t("libraries.installDone", { name: display }));
          await refreshInstalled();
          return;
        } catch (err2) {
          setInstallStatus(null);
          setError(
            options?.git
              ? t("libraries.githubCloneFailed", {
                  detail: mapLibError(err2),
                })
              : mapLibError(err2),
          );
          return;
        }
      }
      setInstallStatus(null);
      setError(
        options?.git
          ? t("libraries.githubCloneFailed", { detail: mapLibError(err) })
          : mapLibError(err),
      );
    } finally {
      setBusyId(null);
      window.setTimeout(() => setInstallStatus(null), 4000);
    }
  };

  const installFromGithub = () => {
    const parsed = parseGithubLibSpec(githubInput);
    if (!parsed.ok) {
      setError(
        parsed.error === "empty"
          ? t("libraries.githubEmpty")
          : t("libraries.githubInvalid"),
      );
      return;
    }
    void install(parsed.spec, `github:${parsed.spec}`, {
      git: true,
      displayName: parsed.label,
    });
  };

  const installStack = async (stackId: string, specs: string[], label: string) => {
    if (!isTauriRuntime()) {
      setError(t("libraries.needDesktop"));
      return;
    }
    if (!rootPath || !isProject) {
      setError(t("libraries.needProject"));
      return;
    }
    if (isAppOffline()) {
      setError(t("libraries.offline"));
      return;
    }
    const pending = specs.filter((spec) => !isInstalledSpec(spec));
    if (pending.length === 0) {
      setInstallStatus(t("libraries.stackDone", { name: label }));
      window.setTimeout(() => setInstallStatus(null), 3000);
      return;
    }
    setBusyId(`stack:${stackId}`);
    setError(null);
    try {
      for (let i = 0; i < pending.length; i++) {
        const spec = pending[i]!;
        setInstallStatus(
          t("libraries.stackProgress", {
            name: label,
            current: String(i + 1),
            total: String(pending.length),
          }),
        );
        try {
          await installPioLibrary(rootPath, spec, selectedEnv || null);
          pushRecent(spec);
        } catch {
          const bare = spec.includes("/") ? spec.split("/").pop()! : spec;
          if (bare !== spec) {
            await installPioLibrary(rootPath, bare, selectedEnv || null);
            pushRecent(spec);
          } else {
            throw new Error(spec);
          }
        }
      }
      setInstallStatus(t("libraries.stackDone", { name: label }));
      await refreshInstalled();
    } catch (err) {
      setInstallStatus(null);
      setError(mapLibError(err));
    } finally {
      setBusyId(null);
      window.setTimeout(() => setInstallStatus(null), 4000);
    }
  };

  const uninstall = async (dep: string) => {
    if (!rootPath || !isProject) {
      setError(t("libraries.needProject"));
      return;
    }
    setBusyId(`uninstall:${dep}`);
    setError(null);
    setInstallStatus(t("libraries.uninstalling"));
    try {
      await uninstallPioLibrary(rootPath, dep, selectedEnv || null);
      setInstallStatus(null);
      await refreshInstalled();
    } catch (err) {
      setInstallStatus(null);
      setError(mapLibError(err));
    } finally {
      setBusyId(null);
    }
  };

  const isInstalledSpec = (spec: string) => {
    const name = spec.includes("/") ? spec.split("/").pop()! : spec;
    return installed.some(
      (d) => depMatches(d, spec) || depMatches(d, name),
    );
  };

  const isInstalledEntry = (entry: PioLibEntry) =>
    isInstalledSpec(entrySpec(entry));

  const renderSpecChip = (spec: string, label?: string) => {
    const hit = isInstalledSpec(spec);
    const busy = busyId === `spec:${spec}`;
    const fav = isFavorite(spec);
    return (
      <span key={spec} className="inline-flex items-center gap-0.5">
        <button
          type="button"
          title={
            fav ? t("libraries.unfavorite") : t("libraries.favorite")
          }
          onClick={() => toggleFavorite(spec)}
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded border border-aether-border",
            fav
              ? "text-aether-warning"
              : "text-aether-fg-dim hover:text-aether-fg",
          )}
        >
          <Star size={11} fill={fav ? "currentColor" : "none"} />
        </button>
        <button
          type="button"
          title={spec}
          disabled={busy || hit}
          onClick={() => void install(spec, `spec:${spec}`)}
          className={cn(
            "rounded border px-2 py-0.5 text-[11px]",
            hit
              ? "border-aether-border text-aether-fg-dim"
              : "border-aether-border text-aether-fg-muted hover:border-aether-accent hover:text-aether-fg",
          )}
        >
          {busy ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 size={10} className="animate-spin" />
              {t("libraries.installing")}
            </span>
          ) : hit ? (
            `${label ?? spec} ✓`
          ) : (
            (label ?? spec)
          )}
        </button>
      </span>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-9 shrink-0 items-center justify-between gap-2 px-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-aether-fg-muted">
          {t("libraries.title")}
        </h2>
        <button
          type="button"
          title={t("libraries.refreshTitle")}
          aria-label={t("libraries.refresh")}
          disabled={!isProject}
          onClick={() => void refreshInstalled()}
          className="flex h-6 w-6 items-center justify-center rounded text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg disabled:opacity-40"
        >
          <RefreshCw size={13} />
        </button>
      </header>

      <div className="mx-3 mb-2 flex rounded border border-aether-border p-0.5">
        {(
          [
            ["platformio", "libraries.tab.platformio", "libraries.tab.platformioTitle"],
            ["arduino", "libraries.tab.arduino", "libraries.tab.arduinoTitle"],
            ["github", "libraries.tab.github", "libraries.tab.githubTitle"],
          ] as const
        ).map(([id, labelKey, tipKey]) => (
          <button
            key={id}
            type="button"
            title={t(tipKey)}
            aria-label={t(labelKey)}
            onClick={() => {
              setManagerTab(id);
              setError(null);
              setResults([]);
              setHasSearched(false);
              if (id === "arduino") {
                setPreset("arduino");
                // Local detect only — registry search waits for Search click.
                if (isTauriRuntime()) {
                  void detectArduinoCli()
                    .then(setArduinoCli)
                    .catch(() =>
                      setArduinoCli({
                        installed: false,
                        path: null,
                        version: null,
                      }),
                    );
                }
              }
            }}
            className={cn(
              "min-w-0 flex-1 rounded px-1.5 py-1 text-[11px]",
              managerTab === id
                ? "bg-aether-accent-muted text-aether-fg"
                : "text-aether-fg-muted hover:text-aether-fg",
            )}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>

      <p className="px-3 pb-2 text-[11px] leading-relaxed text-aether-fg-dim">
        {managerTab === "arduino"
          ? t("libraries.arduinoHint")
          : managerTab === "github"
            ? t("libraries.githubTabHint")
            : t("libraries.hint")}
      </p>

      {managerTab === "arduino" && arduinoCli && (
        <div className="mx-3 mb-2 space-y-1.5 rounded border border-aether-border px-2 py-1.5">
          {arduinoCli.installed ? (
            <p className="text-[11px] text-aether-fg-muted">
              {t("libraries.arduinoCliDetected", {
                version:
                  arduinoCli.version || arduinoCli.path || "ok",
              })}
            </p>
          ) : (
            <>
              <p className="text-[11px] leading-relaxed text-aether-fg">
                {t("libraries.arduinoCliMissing")}
              </p>
              <p className="text-[10px] leading-relaxed text-aether-fg-dim">
                {t("libraries.arduinoCliFallback")}
              </p>
              <button
                type="button"
                title={t("libraries.arduinoCliInstallTitle")}
                aria-label={t("libraries.arduinoCliInstall")}
                onClick={() => {
                  void (async () => {
                    try {
                      const { openUrl } = await import(
                        "@tauri-apps/plugin-opener"
                      );
                      await openUrl(ARDUINO_CLI_DOCS_URL);
                    } catch {
                      window.open(
                        ARDUINO_CLI_DOCS_URL,
                        "_blank",
                        "noopener,noreferrer",
                      );
                    }
                  })();
                }}
                className="rounded border border-aether-accent bg-aether-accent px-2 py-0.5 text-[11px] text-white"
              >
                {t("libraries.arduinoCliInstall")}
              </button>
            </>
          )}
        </div>
      )}

      {!isProject || !rootPath ? (
        <div className="space-y-1.5 px-3">
          <p className="text-xs leading-relaxed text-aether-fg">
            {t("libraries.noProject")}
          </p>
          <p className="text-[11px] leading-relaxed text-aether-fg-dim">
            {t("libraries.noProjectHelp")}
          </p>
        </div>
      ) : (
        <>
          {selectedEnv ? (
            <p className="px-3 pb-1.5 text-[11px] text-aether-fg-dim">
              {t("libraries.activeEnv", { env: selectedEnv })}
            </p>
          ) : null}

          {managerTab === "platformio" && (
            <div className="flex flex-wrap gap-1 px-3 pb-2">
              {PLATFORM_CHIPS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  title={t(c.labelKey)}
                  onClick={() => selectPreset(c.id)}
                  className={cn(
                    "rounded border px-2 py-0.5 text-[11px]",
                    preset === c.id
                      ? "border-aether-accent bg-aether-accent-muted text-aether-fg"
                      : "border-aether-border text-aether-fg-muted hover:border-aether-accent hover:text-aether-fg",
                  )}
                >
                  {t(c.labelKey)}
                </button>
              ))}
            </div>
          )}

          {managerTab !== "github" && (
            <form
              className="flex gap-1 px-3 pb-2"
              onSubmit={(e) => {
                e.preventDefault();
                void runSearch();
              }}
            >
              <div className="relative min-w-0 flex-1">
                <Search
                  size={12}
                  className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-aether-fg-dim"
                />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("libraries.search")}
                  className="h-7 w-full rounded border border-aether-border bg-aether-bg py-1 pl-7 pr-2 text-xs text-aether-fg outline-none focus:border-aether-accent"
                />
              </div>
              <button
                type="submit"
                title={t("libraries.searchBtnTitle")}
                aria-label={t("libraries.searchBtn")}
                disabled={
                  loading ||
                  (!query.trim() &&
                    (useArduinoCli || !chipHasFilter(chip)))
                }
                className="h-7 shrink-0 rounded border border-aether-accent bg-aether-accent px-2 text-[11px] text-white disabled:opacity-40"
              >
                {t("libraries.searchBtn")}
              </button>
            </form>
          )}

          {managerTab === "github" && (
            <>
              <form
                className="flex gap-1 px-3 pb-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  installFromGithub();
                }}
              >
                <div className="relative min-w-0 flex-1">
                  <GitBranch
                    size={12}
                    className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-aether-fg-dim"
                  />
                  <input
                    value={githubInput}
                    onChange={(e) => setGithubInput(e.target.value)}
                    placeholder={t("libraries.githubPlaceholder")}
                    title={t("libraries.githubHint")}
                    className="h-7 w-full rounded border border-aether-border bg-aether-bg py-1 pl-7 pr-2 text-xs text-aether-fg outline-none focus:border-aether-accent"
                  />
                </div>
                <button
                  type="submit"
                  title={t("libraries.githubInstallTitle")}
                  aria-label={t("libraries.githubInstallTitle")}
                  disabled={
                    busyId?.startsWith("github:") || !githubInput.trim()
                  }
                  className="h-7 shrink-0 rounded border border-aether-border bg-aether-surface px-2 text-[11px] text-aether-fg hover:border-aether-accent disabled:opacity-40"
                >
                  {busyId?.startsWith("github:") ? (
                    <span className="inline-flex items-center gap-1">
                      <Loader2 size={10} className="animate-spin" />
                      {t("libraries.installing")}
                    </span>
                  ) : (
                    t("libraries.githubInstall")
                  )}
                </button>
              </form>
              <p className="px-3 pb-2 text-[10px] leading-relaxed text-aether-fg-dim">
                {t("libraries.githubEmptyState")}
              </p>
            </>
          )}

          {showServoHint && (
            <div className="mx-3 mb-2 rounded border border-aether-accent/40 bg-aether-accent-muted/40 px-2 py-1.5 text-[11px] leading-relaxed text-aether-fg">
              <p>{t("libraries.servoHint")}</p>
              <button
                type="button"
                disabled={
                  busyId === `spec:${ESP32_SERVO_SPEC}` ||
                  isInstalledSpec(ESP32_SERVO_SPEC)
                }
                onClick={() =>
                  void install(ESP32_SERVO_SPEC, `spec:${ESP32_SERVO_SPEC}`)
                }
                className="mt-1 inline-flex items-center gap-1 rounded border border-aether-accent bg-aether-accent px-2 py-0.5 text-[11px] text-white disabled:opacity-40"
              >
                <Download size={11} />
                {t("libraries.installEsp32Servo")}
              </button>
            </div>
          )}

          {(installStatus || busyId) && (
            <p className="mx-3 mb-2 flex items-center gap-1.5 text-[11px] text-aether-fg-muted">
              {busyId && <Loader2 size={12} className="animate-spin" />}
              {installStatus || t("libraries.installing")}
            </p>
          )}

          {favorites.length > 0 && (
            <div className="px-3 pb-2">
              <p className="mb-1 text-[11px] uppercase tracking-wide text-aether-fg-dim">
                {t("libraries.favorites")}
              </p>
              <div className="flex flex-wrap gap-1">
                {favorites.map((spec) => renderSpecChip(spec))}
              </div>
            </div>
          )}

          {recent.length > 0 && (
            <div className="px-3 pb-2">
              <p className="mb-1 text-[11px] uppercase tracking-wide text-aether-fg-dim">
                {t("libraries.recent")}
              </p>
              <div className="flex flex-wrap gap-1">
                {recent.map((spec) => renderSpecChip(spec))}
              </div>
            </div>
          )}

          {managerTab !== "github" && stacks.length > 0 && (
            <div className="px-3 pb-2">
              <p className="mb-1 text-[11px] uppercase tracking-wide text-aether-fg-dim">
                {t("libraries.stacks")}
              </p>
              <p className="mb-1.5 text-[10px] leading-relaxed text-aether-fg-dim">
                {t("libraries.stacksHint")}
              </p>
              <div className="flex flex-wrap gap-1">
                {stacks.map((stack) => {
                  const label = t(stack.labelKey);
                  const allHit = stack.specs.every((s) => isInstalledSpec(s));
                  const busy = busyId === `stack:${stack.id}`;
                  return (
                    <button
                      key={stack.id}
                      type="button"
                      title={stack.specs.join(", ")}
                      disabled={busy || allHit}
                      onClick={() =>
                        void installStack(stack.id, stack.specs, label)
                      }
                      className={cn(
                        "rounded border px-2 py-0.5 text-[11px]",
                        allHit
                          ? "border-aether-border text-aether-fg-dim"
                          : "border-aether-accent/50 text-aether-fg-muted hover:border-aether-accent hover:text-aether-fg",
                      )}
                    >
                      {busy ? (
                        <span className="inline-flex items-center gap-1">
                          <Loader2 size={10} className="animate-spin" />
                          {t("libraries.installing")}
                        </span>
                      ) : allHit ? (
                        `${label} ✓`
                      ) : (
                        label
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {managerTab !== "github" && (
          <div className="px-3 pb-2">
            <p className="mb-1 text-[11px] uppercase tracking-wide text-aether-fg-dim">
              {t("libraries.popular")}
            </p>
            <div className="flex flex-wrap gap-1">
              {popular.map((item) => {
                const hit = isInstalledSpec(item.spec);
                const busy = busyId === `popular:${item.spec}`;
                const fav = isFavorite(item.spec);
                return (
                  <span
                    key={item.spec}
                    className="inline-flex items-center gap-0.5"
                  >
                    <button
                      type="button"
                      title={
                        fav
                          ? t("libraries.unfavorite")
                          : t("libraries.favorite")
                      }
                      onClick={() => toggleFavorite(item.spec)}
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded border border-aether-border",
                        fav
                          ? "text-aether-warning"
                          : "text-aether-fg-dim hover:text-aether-fg",
                      )}
                    >
                      <Star
                        size={11}
                        fill={fav ? "currentColor" : "none"}
                      />
                    </button>
                    <button
                      type="button"
                      title={item.spec}
                      disabled={busy || hit}
                      onClick={() =>
                        void install(item.spec, `popular:${item.spec}`)
                      }
                      className={cn(
                        "rounded border px-2 py-0.5 text-[11px]",
                        hit
                          ? "border-aether-border text-aether-fg-dim"
                          : "border-aether-border text-aether-fg-muted hover:border-aether-accent hover:text-aether-fg",
                      )}
                    >
                      {busy ? (
                        <span className="inline-flex items-center gap-1">
                          <Loader2 size={10} className="animate-spin" />
                          {t("libraries.installing")}
                        </span>
                      ) : hit ? (
                        `${item.label} ✓`
                      ) : (
                        item.label
                      )}
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
          )}

          {error && (
            <p
              role="alert"
              className="mx-3 mb-2 rounded border border-aether-danger/40 bg-aether-danger/10 px-2 py-1.5 text-[11px] leading-relaxed text-aether-danger"
            >
              {error}
            </p>
          )}

          <div className="aether-scroll min-h-0 flex-1 overflow-auto border-t border-aether-border">
            <div className="border-b border-aether-border px-3 py-2">
              <p className="mb-1 text-[11px] uppercase tracking-wide text-aether-fg-dim">
                {t("libraries.installedList")}
              </p>
              {installed.length === 0 ? (
                <p className="text-[11px] text-aether-fg-dim">
                  {t("libraries.installedEmpty")}
                </p>
              ) : (
                <ul className="space-y-0.5">
                  {installed.map((dep) => {
                    const busy = busyId === `uninstall:${dep}`;
                    return (
                      <li
                        key={dep}
                        className="flex items-center gap-1.5 text-[11px] text-aether-fg"
                      >
                        <Library
                          size={12}
                          className="shrink-0 text-aether-fg-muted"
                        />
                        <span className="min-w-0 flex-1 truncate" title={dep}>
                          {dep}
                        </span>
                        <button
                          type="button"
                          title={
                            isFavorite(dep)
                              ? t("libraries.unfavorite")
                              : t("libraries.favorite")
                          }
                          onClick={() => toggleFavorite(dep)}
                          className={cn(
                            "flex h-6 w-6 shrink-0 items-center justify-center rounded",
                            isFavorite(dep)
                              ? "text-aether-warning"
                              : "text-aether-fg-dim hover:text-aether-fg",
                          )}
                        >
                          <Star
                            size={11}
                            fill={isFavorite(dep) ? "currentColor" : "none"}
                          />
                        </button>
                        <button
                          type="button"
                          title={t("libraries.uninstallTitle")}
                          aria-label={t("libraries.uninstall")}
                          disabled={busy}
                          onClick={() => void uninstall(dep)}
                          className="flex h-6 shrink-0 items-center gap-1 rounded border border-aether-border px-1.5 text-aether-fg-muted hover:border-aether-danger hover:text-aether-danger disabled:opacity-40"
                        >
                          <Trash2 size={11} />
                          {busy
                            ? t("libraries.uninstalling")
                            : t("libraries.uninstall")}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {loading && (
              <p className="flex items-center gap-1.5 px-3 py-3 text-xs text-aether-fg-dim">
                <Loader2 size={12} className="animate-spin" />
                {t("common.loading")}
              </p>
            )}

            {managerTab !== "github" && !loading && results.length === 0 && (
              <p className="px-3 py-3 text-xs text-aether-fg-dim">
                {hasSearched || query.trim()
                  ? t("libraries.noResults")
                  : managerTab === "arduino"
                    ? t("libraries.arduinoEmpty")
                    : t("libraries.empty")}
              </p>
            )}

            {managerTab !== "github" &&
            results.map((entry) => {
              const spec = entrySpec(entry);
              const installedHit = isInstalledEntry(entry);
              const installBusy = busyId === entry.id;
              const uninstallBusy =
                busyId === `uninstall:${spec}` ||
                installed.some(
                  (d) =>
                    busyId === `uninstall:${d}` && depMatches(d, spec),
                );
              const busy = installBusy || uninstallBusy;
              const fav = isFavorite(spec);
              return (
                <div
                  key={entry.id}
                  className="flex items-start gap-2 border-b border-aether-border/50 px-3 py-2"
                >
                  <Library
                    size={14}
                    className="mt-0.5 shrink-0 text-aether-fg-muted"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-aether-fg">
                      {entry.name}
                      {entry.version ? (
                        <span className="text-aether-fg-dim">
                          {" "}
                          · {entry.version}
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-[11px] text-aether-fg-dim">
                      {entry.owner || "registry"}
                    </p>
                    {entry.description && (
                      <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-aether-fg-muted">
                        {entry.description}
                      </p>
                    )}
                    {entry.platforms?.length > 0 && (
                      <p className="mt-0.5 truncate text-[10px] text-aether-fg-dim">
                        {entry.platforms.slice(0, 6).join(", ")}
                        {entry.platforms.length > 6 ? "…" : ""}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    title={
                      fav ? t("libraries.unfavorite") : t("libraries.favorite")
                    }
                    onClick={() => toggleFavorite(spec)}
                    className={cn(
                      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded border border-aether-border",
                      fav
                        ? "text-aether-warning"
                        : "text-aether-fg-dim hover:text-aether-fg",
                    )}
                  >
                    <Star size={12} fill={fav ? "currentColor" : "none"} />
                  </button>
                  {installedHit ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        const dep =
                          installed.find(
                            (d) =>
                              depMatches(d, spec) ||
                              depMatches(d, entry.name),
                          ) ?? spec;
                        void uninstall(dep);
                      }}
                      className="mt-0.5 flex shrink-0 items-center gap-1 rounded border border-aether-border px-2 py-1 text-[11px] text-aether-fg-muted hover:border-aether-danger hover:text-aether-danger"
                    >
                      <Trash2 size={12} />
                      {uninstallBusy
                        ? t("libraries.uninstalling")
                        : t("libraries.uninstall")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void install(spec, entry.id)}
                      className="mt-0.5 flex shrink-0 items-center gap-1 rounded border border-aether-accent bg-aether-accent px-2 py-1 text-[11px] text-white disabled:opacity-40"
                    >
                      {installBusy ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Download size={12} />
                      )}
                      {installBusy
                        ? t("libraries.installing")
                        : t("libraries.install")}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

