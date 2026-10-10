import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Library, RefreshCw, Search, Trash2 } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { cn } from "@/lib/cn";
import {
  installPioLibrary,
  listPioLibraries,
  searchPioLibraries,
  uninstallPioLibrary,
  type PioLibEntry,
} from "@/lib/platformio";
import { isTauriRuntime } from "@/lib/tauri";
import { usePlatformIoStore } from "@/stores/platformioStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

type PlatformPreset = "all" | "esp32" | "nano" | "mega";

interface PlatformChip {
  id: PlatformPreset;
  labelKey:
    | "libraries.chipAll"
    | "libraries.chipEsp32"
    | "libraries.chipNano"
    | "libraries.chipMega";
  /** PlatformIO `--platform` filter */
  platform: string | null;
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
  esp32: [
    { spec: "bblanchon/ArduinoJson", label: "ArduinoJson" },
    { spec: "knolleary/PubSubClient", label: "PubSubClient" },
    { spec: "esp32async/ESPAsyncWebServer", label: "ESPAsyncWebServer" },
    { spec: "esp32async/AsyncTCP", label: "AsyncTCP" },
    { spec: "tzapu/WiFiManager", label: "WiFiManager" },
    { spec: "fastled/FastLED", label: "FastLED" },
    { spec: "adafruit/Adafruit NeoPixel", label: "NeoPixel" },
    { spec: "olikraus/U8g2", label: "U8g2" },
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

export function LibrariesPanel() {
  const { t } = useI18n();
  const rootPath = useWorkspaceStore((s) => s.rootPath);
  const isProject = usePlatformIoStore((s) => s.isProject);
  const selectedEnv = usePlatformIoStore((s) => s.selectedEnv);
  const [query, setQuery] = useState("");
  const [preset, setPreset] = useState<PlatformPreset>("all");
  const [results, setResults] = useState<PioLibEntry[]>([]);
  const [installed, setInstalled] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const chip: PlatformChip = useMemo(() => {
    return PLATFORM_CHIPS.find((c) => c.id === preset) ?? PLATFORM_CHIPS[0]!;
  }, [preset]);

  const popular = POPULAR[preset];

  const refreshInstalled = useCallback(async () => {
    if (!rootPath || !isProject || !isTauriRuntime()) {
      setInstalled([]);
      return;
    }
    try {
      const list = await listPioLibraries(rootPath);
      setInstalled(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    }
  }, [rootPath, isProject, t]);

  useEffect(() => {
    void refreshInstalled();
  }, [refreshInstalled]);

  const runSearch = useCallback(
    async (overrideQuery?: string) => {
      const q = (overrideQuery ?? query).trim();
      if (!q && !chip.platform) {
        setResults([]);
        setHasSearched(false);
        return;
      }
      if (!isTauriRuntime()) {
        setError(t("libraries.needDesktop"));
        return;
      }
      setLoading(true);
      setError(null);
      setHasSearched(true);
      try {
        const entries = await searchPioLibraries({
          query: q,
          platform: chip.platform,
          framework: chip.framework,
          pages: 3,
        });
        setResults(entries);
      } catch (err) {
        setResults([]);
        setError(err instanceof Error ? err.message : t("common.error"));
      } finally {
        setLoading(false);
      }
    },
    [query, chip, t],
  );

  const selectPreset = (id: PlatformPreset) => {
    setPreset(id);
    setError(null);
    const next = PLATFORM_CHIPS.find((c) => c.id === id);
    if (next?.platform) {
      // Browse registry for that platform when switching chips.
      void (async () => {
        setLoading(true);
        setHasSearched(true);
        try {
          const entries = await searchPioLibraries({
            query: query.trim(),
            platform: next.platform,
            framework: next.framework,
            pages: 2,
          });
          setResults(entries);
        } catch (err) {
          setResults([]);
          setError(err instanceof Error ? err.message : t("common.error"));
        } finally {
          setLoading(false);
        }
      })();
    } else if (!query.trim()) {
      setResults([]);
      setHasSearched(false);
    }
  };

  const install = async (library: string, busyKey: string) => {
    if (!rootPath) return;
    setBusyId(busyKey);
    setError(null);
    try {
      await installPioLibrary(rootPath, library, selectedEnv || null);
      await refreshInstalled();
    } catch (err) {
      // Retry with bare name (after last slash) for older specs.
      const bare = library.includes("/")
        ? library.split("/").pop()!
        : library;
      try {
        await installPioLibrary(rootPath, bare, selectedEnv || null);
        await refreshInstalled();
      } catch (err2) {
        setError(err2 instanceof Error ? err2.message : t("common.error"));
      }
    } finally {
      setBusyId(null);
    }
  };

  const uninstall = async (dep: string) => {
    if (!rootPath) return;
    setBusyId(`uninstall:${dep}`);
    setError(null);
    try {
      await uninstallPioLibrary(rootPath, dep, selectedEnv || null);
      await refreshInstalled();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
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

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-9 shrink-0 items-center justify-between gap-2 px-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-aether-fg-muted">
          {t("libraries.title")}
        </h2>
        <button
          type="button"
          title={t("libraries.refresh")}
          disabled={!isProject}
          onClick={() => void refreshInstalled()}
          className="flex h-6 w-6 items-center justify-center rounded text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg disabled:opacity-40"
        >
          <RefreshCw size={13} />
        </button>
      </header>

      {!isProject || !rootPath ? (
        <p className="px-3 text-xs leading-relaxed text-aether-fg-dim">
          {t("libraries.noProject")}
        </p>
      ) : (
        <>
          {selectedEnv ? (
            <p className="px-3 pb-1.5 text-[11px] text-aether-fg-dim">
              {t("libraries.activeEnv", { env: selectedEnv })}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-1 px-3 pb-2">
            {PLATFORM_CHIPS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => selectPreset(c.id)}
                className={cn(
                  "rounded px-2 py-0.5 text-[11px]",
                  preset === c.id
                    ? "bg-aether-accent-muted text-aether-fg"
                    : "text-aether-fg-muted hover:text-aether-fg",
                )}
              >
                {t(c.labelKey)}
              </button>
            ))}
          </div>

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
              disabled={loading || (!query.trim() && !chip.platform)}
              className="h-7 shrink-0 rounded border border-aether-accent bg-aether-accent px-2 text-[11px] text-white disabled:opacity-40"
            >
              {t("libraries.searchBtn")}
            </button>
          </form>

          <div className="px-3 pb-2">
            <p className="mb-1 text-[11px] uppercase tracking-wide text-aether-fg-dim">
              {t("libraries.popular")}
            </p>
            <div className="flex flex-wrap gap-1">
              {popular.map((item) => {
                const hit = isInstalledSpec(item.spec);
                const busy = busyId === `popular:${item.spec}`;
                return (
                  <button
                    key={item.spec}
                    type="button"
                    title={item.spec}
                    disabled={busy || hit}
                    onClick={() => void install(item.spec, `popular:${item.spec}`)}
                    className={cn(
                      "rounded border px-2 py-0.5 text-[11px]",
                      hit
                        ? "border-aether-border text-aether-fg-dim"
                        : "border-aether-border text-aether-fg-muted hover:border-aether-accent hover:text-aether-fg",
                    )}
                  >
                    {busy
                      ? t("libraries.installing")
                      : hit
                        ? `${item.label} ✓`
                        : item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <p className="px-3 pb-2 text-[11px] text-aether-danger">{error}</p>
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
                        <Library size={12} className="shrink-0 text-aether-fg-muted" />
                        <span className="min-w-0 flex-1 truncate" title={dep}>
                          {dep}
                        </span>
                        <button
                          type="button"
                          title={t("libraries.uninstall")}
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
              <p className="px-3 py-3 text-xs text-aether-fg-dim">
                {t("common.loading")}
              </p>
            )}

            {!loading && results.length === 0 && (
              <p className="px-3 py-3 text-xs text-aether-fg-dim">
                {hasSearched || query.trim()
                  ? t("libraries.noResults")
                  : t("libraries.empty")}
              </p>
            )}

            {results.map((entry) => {
              const spec = entrySpec(entry);
              const installedHit = isInstalledEntry(entry);
              const installBusy = busyId === entry.id;
              const uninstallBusy =
                busyId === `uninstall:${spec}` ||
                installed.some((d) => busyId === `uninstall:${d}` && depMatches(d, spec));
              const busy = installBusy || uninstallBusy;
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
                      <Download size={12} />
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
