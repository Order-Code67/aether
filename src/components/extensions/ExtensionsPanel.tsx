import { useEffect, useMemo, useState } from "react";
import {
  Blocks,
  Download,
  FolderOpen,
  Link2,
  Puzzle,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { PublishPanel } from "@/components/extensions/PublishPanel";
import { useI18n } from "@/hooks/useI18n";
import { cn } from "@/lib/cn";
import { isTauriRuntime } from "@/lib/tauri";
import { useExtensionStore } from "@/stores/extensionStore";
import { useOfflineStore } from "@/stores/offlineStore";
import type { ExtensionCategory, ExtensionManifest } from "@/types/extensions";

const CATEGORY_LABEL: Record<ExtensionCategory, string> = {
  snippets: "Snippets",
  boards: "Boards",
  languages: "Languages",
  themes: "Themes",
  other: "Other",
};

type PanelTab = "installed" | "marketplace" | "publish";

export function ExtensionsPanel() {
  const { t } = useI18n();
  const allManifests = useExtensionStore((s) => s.allManifests);
  const enabledIds = useExtensionStore((s) => s.enabledIds);
  const isEnabled = useExtensionStore((s) => s.isEnabled);
  const toggle = useExtensionStore((s) => s.toggle);
  const installFromFolder = useExtensionStore((s) => s.installFromFolder);
  const installFromUrl = useExtensionStore((s) => s.installFromUrl);
  const installFromCatalog = useExtensionStore((s) => s.installFromCatalog);
  const uninstallLocal = useExtensionStore((s) => s.uninstallLocal);
  const catalog = useExtensionStore((s) => s.catalog);
  const catalogUrl = useExtensionStore((s) => s.catalogUrl);
  const catalogLoading = useExtensionStore((s) => s.catalogLoading);
  const setCatalogUrl = useExtensionStore((s) => s.setCatalogUrl);
  const refreshCatalog = useExtensionStore((s) => s.refreshCatalog);
  const isInstalled = useExtensionStore((s) => s.isInstalled);
  const error = useExtensionStore((s) => s.error);
  const preferredPanelTab = useExtensionStore((s) => s.preferredPanelTab);
  const setPreferredPanelTab = useExtensionStore((s) => s.setPreferredPanelTab);
  const offline = useOfflineStore((s) => s.offline);
  const [tab, setTab] = useState<PanelTab>("installed");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "enabled" | "disabled">("all");
  const [urlInput, setUrlInput] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (preferredPanelTab) {
      setTab(preferredPanelTab);
      setPreferredPanelTab(null);
    }
  }, [preferredPanelTab, setPreferredPanelTab]);

  useEffect(() => {
    if (tab === "marketplace" && !catalog) {
      void refreshCatalog();
    }
  }, [tab, catalog, refreshCatalog]);

  const manifests = allManifests();
  const selected =
    manifests.find((m) => m.id === selectedId) ?? manifests[0] ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return manifests.filter((m) => {
      const on = enabledIds.includes(m.id);
      if (filter === "enabled" && !on) return false;
      if (filter === "disabled" && on) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.publisher.toLowerCase().includes(q)
      );
    });
  }, [manifests, query, filter, enabledIds]);

  const marketEntries = useMemo(() => {
    const entries = catalog?.entries ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q),
    );
  }, [catalog, query]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-9 shrink-0 items-center justify-between gap-2 px-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-aether-fg-muted">
          {t("extensions.title")}
        </h2>
        <div className="flex items-center gap-0.5">
          {tab === "installed" && (
            <button
              type="button"
              title={t("extensions.loadFolderTitle")}
              aria-label={t("extensions.loadFolderTitle")}
              disabled={!isTauriRuntime()}
              onClick={() => {
                void installFromFolder().then((ok) => {
                  if (ok) {
                    const locals =
                      useExtensionStore.getState().localExtensions;
                    const last = locals[locals.length - 1];
                    if (last) setSelectedId(last.id);
                  }
                });
              }}
              className="flex h-6 items-center gap-1 rounded px-1.5 text-[11px] text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg disabled:opacity-40"
            >
              <FolderOpen size={13} />
              Load…
            </button>
          )}
          {tab === "marketplace" && (
            <button
              type="button"
              title={t("extensions.refreshCatalogTitle")}
              aria-label={t("extensions.refreshCatalogTitle")}
              disabled={catalogLoading}
              onClick={() => void refreshCatalog()}
              className="flex h-6 items-center gap-1 rounded px-1.5 text-[11px] text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg disabled:opacity-40"
            >
              <RefreshCw size={13} className={catalogLoading ? "animate-spin" : ""} />
              Refresh
            </button>
          )}
        </div>
      </header>

      <p
        data-testid="extensions-store-not-yet"
        className="mx-3 mb-2 rounded border border-aether-border/70 bg-aether-bg/50 px-2 py-1.5 text-[11px] leading-snug text-aether-fg-dim"
      >
        {t("extensions.storeNotYet")}
      </p>

      <div className="flex gap-1 px-3 pb-2">
        {(
          [
            ["installed", "extensions.installed"],
            ["marketplace", "extensions.marketplace"],
            ["publish", "extensions.publish"],
          ] as const
        ).map(([id, labelKey]) => {
          const tipKey =
            id === "installed"
              ? "extensions.tab.installedTitle"
              : id === "marketplace"
                ? "extensions.tab.marketplaceTitle"
                : "extensions.tab.publishTitle";
          return (
          <button
            key={id}
            type="button"
            title={t(tipKey)}
            aria-label={t(labelKey)}
            onClick={() => setTab(id)}
            className={cn(
              "rounded px-2 py-0.5 text-[11px]",
              tab === id
                ? "bg-aether-accent-muted text-aether-fg"
                : "text-aether-fg-muted hover:text-aether-fg",
            )}
          >
            {t(labelKey)}
          </button>
          );
        })}
      </div>

      {tab === "publish" ? (
        <PublishPanel />
      ) : (
        <>
      <div className="flex flex-col gap-2 px-3 pb-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            tab === "marketplace" ? "Search marketplace" : "Search extensions"
          }
          className="h-7 rounded border border-aether-border bg-aether-bg px-2 text-xs text-aether-fg outline-none focus:border-aether-accent"
        />
        {tab === "installed" && (
          <div className="flex gap-1">
            {(
              [
                ["all", "All"],
                ["enabled", "Enabled"],
                ["disabled", "Disabled"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                title={t(
                  id === "all"
                    ? "extensions.filter.allTitle"
                    : id === "enabled"
                      ? "extensions.filter.enabledTitle"
                      : "extensions.filter.disabledTitle",
                )}
                aria-label={label}
                onClick={() => setFilter(id)}
                className={cn(
                  "rounded px-2 py-0.5 text-[11px]",
                  filter === id
                    ? "bg-aether-accent-muted text-aether-fg"
                    : "text-aether-fg-muted hover:text-aether-fg",
                )}
              >
                {label}
              </button>
            ))}
            <span className="ml-auto self-center text-[11px] text-aether-fg-dim">
              {enabledIds.length} on
            </span>
          </div>
        )}
      </div>

      {error && (
        <p className="px-3 pb-2 text-[11px] text-aether-danger">{error}</p>
      )}

      {tab === "marketplace" && offline && (
        <p className="px-3 pb-2 text-[11px] text-amber-600 dark:text-amber-300">
          {t("extensions.offline")}
        </p>
      )}
      {tab === "marketplace" ? (
        <div className="aether-scroll min-h-0 flex-1 overflow-auto border-t border-aether-border">
          <div className="space-y-2 border-b border-aether-border px-3 py-2">
            <label className="block text-[11px] text-aether-fg-dim">
              Catalog URL (optional override)
              <input
                value={catalogUrl}
                onChange={(e) => setCatalogUrl(e.target.value)}
                placeholder="https://…/catalog.json"
                className="mt-0.5 h-7 w-full rounded border border-aether-border bg-aether-bg px-2 text-xs text-aether-fg outline-none focus:border-aether-accent"
              />
            </label>
            <form
              className="flex gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                if (!urlInput.trim()) return;
                void installFromUrl(urlInput.trim()).then((ok) => {
                  if (ok) {
                    setUrlInput("");
                    setTab("installed");
                  }
                });
              }}
            >
              <input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Install from extension.json URL…"
                className="h-7 min-w-0 flex-1 rounded border border-aether-border bg-aether-bg px-2 text-xs text-aether-fg outline-none focus:border-aether-accent"
              />
              <button
                type="submit"
                title={t("extensions.installUrlTitle")}
                aria-label={t("extensions.installUrlTitle")}
                className="flex h-7 w-7 items-center justify-center rounded border border-aether-border text-aether-fg-muted hover:text-aether-fg"
              >
                <Link2 size={13} />
              </button>
            </form>
          </div>

          {catalogLoading && (
            <p className="px-3 py-3 text-xs text-aether-fg-dim">
              Loading catalog…
            </p>
          )}
          {!catalogLoading && marketEntries.length === 0 && (
            <p className="px-3 py-3 text-xs text-aether-fg-dim">
              No marketplace entries.
            </p>
          )}
          {marketEntries.map((entry) => {
            const installed = isInstalled(entry.id);
            return (
              <div
                key={entry.id}
                className="flex items-start gap-2 border-b border-aether-border/50 px-3 py-2"
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded bg-aether-bg text-aether-fg-muted">
                  <Puzzle size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-aether-fg">{entry.name}</p>
                  <p className="truncate text-[11px] text-aether-fg-dim">
                    {entry.publisher} · {entry.category}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-aether-fg-muted">
                    {entry.description}
                  </p>
                </div>
                <button
                  type="button"
                  title={t("extensions.installTitle")}
                  aria-label={t("extensions.installTitle")}
                  disabled={busyId === entry.id}
                  onClick={() => {
                    setBusyId(entry.id);
                    void installFromCatalog(entry).then((ok) => {
                      setBusyId(null);
                      if (ok) setTab("installed");
                    });
                  }}
                  className={cn(
                    "mt-0.5 flex shrink-0 items-center gap-1 rounded border px-2 py-1 text-[11px]",
                    installed
                      ? "border-aether-border text-aether-fg-muted hover:text-aether-fg"
                      : "border-aether-accent bg-aether-accent text-white",
                  )}
                >
                  <Download size={12} />
                  {busyId === entry.id
                    ? "…"
                    : installed
                      ? "Update"
                      : "Install"}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <div className="aether-scroll min-h-0 flex-1 overflow-auto border-t border-aether-border">
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-xs text-aether-fg-dim">
                No extensions.
              </p>
            ) : (
              filtered.map((ext) => (
                <ExtensionRow
                  key={ext.id}
                  ext={ext}
                  active={selected?.id === ext.id}
                  enabled={isEnabled(ext.id)}
                  onSelect={() => setSelectedId(ext.id)}
                  onToggle={() => toggle(ext.id)}
                />
              ))
            )}
          </div>
          {selected && (
            <ExtensionDetails
              ext={selected}
              enabled={isEnabled(selected.id)}
              onToggle={() => toggle(selected.id)}
              onUninstall={
                selected.source === "local"
                  ? () => {
                      uninstallLocal(selected.id);
                      setSelectedId(null);
                    }
                  : undefined
              }
            />
          )}
        </>
      )}
        </>
      )}
    </div>
  );
}

function ExtensionRow({
  ext,
  active,
  enabled,
  onSelect,
  onToggle,
}: {
  ext: ExtensionManifest;
  active: boolean;
  enabled: boolean;
  onSelect: () => void;
  onToggle: () => void;
}) {
  const { t } = useI18n();
  return (
    <div
      className={cn(
        "flex items-start gap-2 border-b border-aether-border/50 px-3 py-2",
        active && "bg-aether-accent-muted/40",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 gap-2 text-left"
      >
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded bg-aether-bg text-aether-fg-muted">
          {ext.category === "boards" ? (
            <Blocks size={14} />
          ) : (
            <Puzzle size={14} />
          )}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-xs text-aether-fg">
            {ext.name}
          </span>
          <span className="block truncate text-[11px] text-aether-fg-dim">
            {ext.publisher} · {CATEGORY_LABEL[ext.category]}
            {ext.source === "local" ? " · local" : ""}
          </span>
        </span>
      </button>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        title={enabled ? t("extensions.disableTitle") : t("extensions.enableTitle")}
        aria-label={
          enabled ? t("extensions.disableTitle") : t("extensions.enableTitle")
        }
        onClick={onToggle}
        className={cn(
          "mt-1 h-5 w-9 shrink-0 rounded-full border transition-colors",
          enabled
            ? "border-aether-accent bg-aether-accent"
            : "border-aether-border bg-aether-bg",
        )}
      >
        <span
          className={cn(
            "block h-4 w-4 rounded-full bg-white transition-transform",
            enabled ? "translate-x-4" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}

function ExtensionDetails({
  ext,
  enabled,
  onToggle,
  onUninstall,
}: {
  ext: ExtensionManifest;
  enabled: boolean;
  onToggle: () => void;
  onUninstall?: () => void;
}) {
  const { t } = useI18n();
  const snippetCount = ext.contributes?.snippets?.length ?? 0;
  const boardCount = ext.contributes?.boards?.length ?? 0;

  return (
    <div className="shrink-0 border-t border-aether-border bg-aether-bg/50 px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-aether-fg">
            {ext.name}
          </p>
          <p className="truncate text-[11px] text-aether-fg-dim">
            {ext.id} · v{ext.version}
          </p>
        </div>
        <button
          type="button"
          title={
            enabled ? t("extensions.disableTitle") : t("extensions.enableTitle")
          }
          aria-label={
            enabled ? t("extensions.disableTitle") : t("extensions.enableTitle")
          }
          onClick={onToggle}
          className={cn(
            "shrink-0 rounded border px-2 py-1 text-[11px]",
            enabled
              ? "border-aether-border text-aether-fg-muted hover:text-aether-fg"
              : "border-aether-accent bg-aether-accent text-white",
          )}
        >
          {enabled ? "Disable" : "Enable"}
        </button>
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-aether-fg-muted">
        {ext.description}
      </p>
      <p className="mt-1 text-[11px] text-aether-fg-dim">
        {snippetCount > 0 && `${snippetCount} snippets`}
        {snippetCount > 0 && boardCount > 0 && " · "}
        {boardCount > 0 && `${boardCount} boards`}
        {snippetCount === 0 && boardCount === 0 && "No contributions listed"}
      </p>
      {onUninstall && (
        <button
          type="button"
          title={t("extensions.uninstallTitle")}
          aria-label={t("extensions.uninstallTitle")}
          onClick={onUninstall}
          className="mt-2 flex items-center gap-1 text-[11px] text-aether-danger hover:opacity-90"
        >
          <Trash2 size={12} />
          Remove local extension
        </button>
      )}
    </div>
  );
}
