import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { cn } from "@/lib/cn";
import {
  FC_PARAM_GROUPS,
  filterCliParams,
  formatCliParamWrite,
  type FcCliParam,
} from "@/lib/fcCliParams";
import { readTuningSnapshot, writeCliLines } from "@/lib/mspTuningIo";
import { useSettingsStore } from "@/stores/settingsStore";

interface Props {
  connected: boolean;
  sessionActive: boolean;
}

export function InavParamsCard({ connected, sessionActive }: Props) {
  const { t } = useI18n();
  const flash = useSettingsStore((s) => s.flashNotice);
  const [params, setParams] = useState<FcCliParam[]>([]);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<string>("all");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const live = connected && sessionActive;

  const filtered = useMemo(
    () => filterCliParams(params, query, group === "all" ? "all" : group),
    [params, query, group],
  );

  const onLoad = async () => {
    if (!live) {
      flash(t("inav.msp.needConnect"));
      return;
    }
    setBusy(true);
    try {
      const result = await readTuningSnapshot({ forceRefresh: true });
      if (!result.ok) {
        flash(result.error);
        return;
      }
      setParams(result.snapshot.params);
      setDirty(new Set());
      flash(t("inav.params.loaded", { count: String(result.snapshot.params.length) }));
    } finally {
      setBusy(false);
    }
  };

  const onChangeValue = (name: string, value: string) => {
    setParams((prev) =>
      prev.map((p) => (p.name === name ? { ...p, value } : p)),
    );
    setDirty((d) => new Set(d).add(name));
  };

  const onWriteDirty = async () => {
    if (!live || dirty.size === 0) return;
    if (!window.confirm(t("inav.params.writeConfirm", { count: String(dirty.size) }))) {
      return;
    }
    setBusy(true);
    try {
      const lines = params
        .filter((p) => dirty.has(p.name))
        .map((p) => formatCliParamWrite(p));
      const result = await writeCliLines(lines, "params_prewrite", lines.join("\n") + "\n");
      if (!result.ok) {
        flash(result.error);
        return;
      }
      setDirty(new Set());
      flash(
        result.backupPath
          ? t("inav.tuning.writeOkBackup", { path: result.backupPath })
          : t("inav.tuning.writeOk"),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className="flex min-h-0 flex-1 flex-col gap-2 rounded border border-aether-border bg-aether-surface-raised/40 p-2"
      data-testid="inav-params-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-aether-fg-dim">
            {t("inav.params.title")}
          </p>
          <p className="text-[10px] text-aether-fg-dim">{t("inav.params.hint")}</p>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            disabled={!live || busy}
            onClick={() => void onLoad()}
            className="flex h-7 items-center gap-1 rounded border border-aether-border px-2 text-[11px] text-aether-fg hover:bg-aether-surface-raised disabled:opacity-40"
          >
            <RefreshCw size={12} className={cn(busy && "animate-spin")} />
            {t("inav.params.load")}
          </button>
          <button
            type="button"
            disabled={!live || busy || dirty.size === 0}
            onClick={() => void onWriteDirty()}
            className="h-7 rounded border border-aether-accent bg-aether-accent-muted px-2 text-[11px] text-aether-fg disabled:opacity-40"
          >
            {t("inav.params.write", { count: String(dirty.size) })}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("inav.params.search")}
          className="h-7 min-w-[140px] flex-1 rounded border border-aether-border bg-aether-bg px-2 text-[11px] text-aether-fg outline-none focus:border-aether-accent"
        />
        <select
          value={group}
          onChange={(e) => setGroup(e.target.value)}
          className="h-7 rounded border border-aether-border bg-aether-bg px-1.5 text-[11px] text-aether-fg"
        >
          <option value="all">{t("inav.params.allGroups")}</option>
          {FC_PARAM_GROUPS.map((g) => (
            <option key={g.id} value={g.id}>
              {g.label}
            </option>
          ))}
        </select>
      </div>

      <ul className="aether-scroll max-h-[360px] min-h-[120px] flex-1 space-y-0.5 overflow-auto">
        {filtered.length === 0 ? (
          <li className="text-[11px] text-aether-fg-dim">{t("inav.params.empty")}</li>
        ) : (
          filtered.slice(0, 200).map((p) => (
            <li
              key={`${p.kind}:${p.name}`}
              className={cn(
                "flex items-center gap-2 rounded px-1.5 py-1 text-[11px]",
                dirty.has(p.name) && "bg-aether-accent-muted/40",
              )}
            >
              <span
                className="w-14 shrink-0 text-[9px] uppercase text-aether-fg-dim"
                title={p.kind}
              >
                {p.kind}
              </span>
              <span className="min-w-0 flex-1 truncate font-mono text-aether-fg">
                {p.name}
              </span>
              <input
                value={p.value}
                onChange={(e) => onChangeValue(p.name, e.target.value)}
                className="h-6 w-28 shrink-0 rounded border border-aether-border bg-aether-bg px-1 font-mono text-[10px] text-aether-fg"
              />
            </li>
          ))
        )}
      </ul>
      {filtered.length > 200 && (
        <p className="text-[10px] text-aether-fg-dim">
          {t("inav.params.truncated", { shown: "200", total: String(filtered.length) })}
        </p>
      )}
    </section>
  );
}
