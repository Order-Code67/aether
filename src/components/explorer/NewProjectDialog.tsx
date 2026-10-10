import { useEffect, useMemo, useRef, useState } from "react";
import { FolderOpen, X } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { cn } from "@/lib/cn";
import { pickParentFolder } from "@/lib/fsWorkspace";
import { initPioProject, type PioStarter } from "@/lib/platformio";
import { isValidEntryName, joinPath } from "@/lib/paths";
import { isTauriRuntime } from "@/lib/tauri";
import { useExtensionStore } from "@/stores/extensionStore";
import { usePlatformIoStore } from "@/stores/platformioStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

const FEATURED_BOARDS = [
  { id: "esp32dev", labelKey: "wizard.board.esp32" as const },
  { id: "megaatmega2560", labelKey: "wizard.board.mega" as const },
  { id: "nanoatmega328", labelKey: "wizard.board.nano" as const },
];

const OTHER_BOARD_PRESETS: { id: string; label: string }[] = [
  { id: "esp32-s3-devkitc-1", label: "ESP32-S3 DevKitC" },
  { id: "esp8266", label: "ESP8266 (generic)" },
  { id: "nodemcuv2", label: "NodeMCU 1.0 (ESP-12E)" },
  { id: "uno", label: "Arduino Uno" },
  { id: "teensy41", label: "Teensy 4.1" },
  { id: "pico", label: "Raspberry Pi Pico" },
];

interface NewProjectDialogProps {
  open: boolean;
  onClose: () => void;
}

export function NewProjectDialog({ open, onClose }: NewProjectDialogProps) {
  const { t } = useI18n();
  const openFolderAt = useWorkspaceStore((s) => s.openFolderAt);
  const refreshProject = usePlatformIoStore((s) => s.refreshProject);
  const enabledIds = useExtensionStore((s) => s.enabledIds);
  const [parent, setParent] = useState("");
  const [name, setName] = useState("my_firmware");
  const [boardMode, setBoardMode] = useState<"featured" | "other">("featured");
  const [board, setBoard] = useState("esp32dev");
  const [starter, setStarter] = useState<PioStarter>("blink");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const otherBoards = useMemo(() => {
    const seen = new Set([
      ...FEATURED_BOARDS.map((b) => b.id),
      ...OTHER_BOARD_PRESETS.map((b) => b.id),
    ]);
    const extra = useExtensionStore
      .getState()
      .boardPresets()
      .filter((b) => !seen.has(b.id));
    return [...OTHER_BOARD_PRESETS, ...extra];
  }, [enabledIds]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setBusy(false);
    const tmr = window.setTimeout(() => nameRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.clearTimeout(tmr);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open, busy, onClose]);

  if (!open) return null;

  const canSubmit =
    isTauriRuntime() &&
    parent.trim().length > 0 &&
    isValidEntryName(name) &&
    board.trim().length > 0 &&
    !busy;

  const create = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const path = await initPioProject({
        parent: parent.trim(),
        name: name.trim(),
        board: board.trim(),
        framework: "arduino",
        starter,
      });
      onClose();
      await openFolderAt(path);
      await refreshProject();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("wizard.error"),
      );
      setBusy(false);
    }
  };

  return (
    <div
      className="absolute inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-[10vh]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("wizard.title")}
        data-aether-chrome
        className="flex w-full max-w-lg flex-col overflow-hidden rounded border border-aether-border bg-aether-surface shadow-2xl"
      >
        <header className="flex h-10 shrink-0 items-center justify-between border-b border-aether-border px-3">
          <h2 className="text-sm font-medium text-aether-fg">
            {t("wizard.title")}
          </h2>
          <button
            type="button"
            title={t("wizard.close")}
            aria-label={t("wizard.close")}
            disabled={busy}
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg disabled:opacity-40"
          >
            <X size={16} />
          </button>
        </header>

        <div className="flex max-h-[70vh] flex-col gap-3 overflow-auto px-4 py-4">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wide text-aether-fg-muted">
              {t("wizard.name")}
            </span>
            <input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
              className="h-8 rounded border border-aether-border bg-aether-bg px-2 text-xs text-aether-fg outline-none focus:border-aether-accent"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wide text-aether-fg-muted">
              {t("wizard.parent")}
            </span>
            <div className="flex gap-1">
              <input
                value={parent}
                onChange={(e) => setParent(e.target.value)}
                placeholder="D:\Projects"
                disabled={busy}
                className="h-8 min-w-0 flex-1 rounded border border-aether-border bg-aether-bg px-2 text-xs text-aether-fg outline-none focus:border-aether-accent"
              />
              <button
                type="button"
                disabled={busy}
                title={t("wizard.browse")}
                onClick={() => {
                  void (async () => {
                    const picked = await pickParentFolder(
                      t("wizard.parent"),
                    );
                    if (picked) setParent(picked);
                  })();
                }}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-aether-border text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg disabled:opacity-40"
              >
                <FolderOpen size={14} />
              </button>
            </div>
          </label>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-[11px] font-medium uppercase tracking-wide text-aether-fg-muted">
              {t("wizard.board")}
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {FEATURED_BOARDS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setBoardMode("featured");
                    setBoard(b.id);
                  }}
                  className={cn(
                    "rounded border px-2.5 py-1.5 text-[11px]",
                    boardMode === "featured" && board === b.id
                      ? "border-aether-accent bg-aether-accent/15 text-aether-fg"
                      : "border-aether-border text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg",
                  )}
                >
                  {t(b.labelKey)}
                </button>
              ))}
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setBoardMode("other");
                  if (!otherBoards.some((b) => b.id === board)) {
                    setBoard(otherBoards[0]?.id ?? "uno");
                  }
                }}
                className={cn(
                  "rounded border px-2.5 py-1.5 text-[11px]",
                  boardMode === "other"
                    ? "border-aether-accent bg-aether-accent/15 text-aether-fg"
                    : "border-aether-border text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg",
                )}
              >
                {t("wizard.board.other")}
              </button>
            </div>
            {boardMode === "other" && (
              <select
                value={board}
                onChange={(e) => setBoard(e.target.value)}
                disabled={busy}
                className="mt-1 h-8 rounded border border-aether-border bg-aether-bg px-2 text-xs text-aether-fg outline-none focus:border-aether-accent"
              >
                {otherBoards.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label} ({b.id})
                  </option>
                ))}
              </select>
            )}
          </fieldset>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wide text-aether-fg-muted">
              {t("wizard.framework")}
            </span>
            <select
              value="arduino"
              disabled
              className="h-8 rounded border border-aether-border bg-aether-bg px-2 text-xs text-aether-fg outline-none opacity-80"
            >
              <option value="arduino">{t("wizard.framework.arduino")}</option>
            </select>
          </label>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-[11px] font-medium uppercase tracking-wide text-aether-fg-muted">
              {t("wizard.starter")}
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["none", "wizard.starter.none"],
                  ["blink", "wizard.starter.blink"],
                  ["servo", "wizard.starter.servo"],
                ] as const
              ).map(([id, key]) => (
                <button
                  key={id}
                  type="button"
                  disabled={busy}
                  onClick={() => setStarter(id)}
                  className={cn(
                    "rounded border px-2.5 py-1.5 text-[11px]",
                    starter === id
                      ? "border-aether-accent bg-aether-accent/15 text-aether-fg"
                      : "border-aether-border text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg",
                  )}
                >
                  {t(key)}
                </button>
              ))}
            </div>
          </fieldset>

          {parent && name.trim() && (
            <p
              className="truncate text-[11px] text-aether-fg-dim"
              title={joinPath(parent, name.trim())}
            >
              {t("wizard.pathPreview")}: {joinPath(parent, name.trim())}
            </p>
          )}

          {error && (
            <p className="text-[11px] leading-relaxed text-aether-danger">
              {error}
            </p>
          )}

          {!isTauriRuntime() && (
            <p className="text-[11px] text-aether-warning">
              {t("wizard.needDesktop")}
            </p>
          )}
        </div>

        <footer className="flex justify-end gap-2 border-t border-aether-border px-3 py-2.5">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded px-3 py-1.5 text-xs text-aether-fg-muted hover:text-aether-fg disabled:opacity-40"
          >
            {t("wizard.cancel")}
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => {
              void create();
            }}
            className={cn(
              "rounded bg-aether-accent px-3 py-1.5 text-xs font-medium text-white",
              "hover:opacity-90 disabled:opacity-40",
            )}
          >
            {busy ? t("wizard.creating") : t("wizard.create")}
          </button>
        </footer>
      </div>
    </div>
  );
}
