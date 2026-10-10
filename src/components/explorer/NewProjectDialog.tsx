import { useEffect, useMemo, useRef, useState } from "react";
import { FolderOpen, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { pickParentFolder } from "@/lib/fsWorkspace";
import { initPioProject } from "@/lib/platformio";
import { isValidEntryName, joinPath } from "@/lib/paths";
import { isTauriRuntime } from "@/lib/tauri";
import { useExtensionStore } from "@/stores/extensionStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

const CORE_BOARD_PRESETS: { id: string; label: string }[] = [
  { id: "esp32dev", label: "ESP32 Dev Module" },
  { id: "esp32-s3-devkitc-1", label: "ESP32-S3 DevKitC" },
  { id: "esp8266", label: "ESP8266 (generic)" },
  { id: "nodemcuv2", label: "NodeMCU 1.0 (ESP-12E)" },
  { id: "uno", label: "Arduino Uno" },
  { id: "nanoatmega328", label: "Arduino Nano" },
  { id: "megaatmega2560", label: "Arduino Mega 2560" },
  { id: "teensy41", label: "Teensy 4.1" },
  { id: "pico", label: "Raspberry Pi Pico" },
];

interface NewProjectDialogProps {
  open: boolean;
  onClose: () => void;
}

export function NewProjectDialog({ open, onClose }: NewProjectDialogProps) {
  const openFolderAt = useWorkspaceStore((s) => s.openFolderAt);
  const enabledIds = useExtensionStore((s) => s.enabledIds);
  const [parent, setParent] = useState("");
  const [name, setName] = useState("my_firmware");
  const [board, setBoard] = useState("esp32dev");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const boardPresets = useMemo(() => {
    const seen = new Set(CORE_BOARD_PRESETS.map((b) => b.id));
    const extra = useExtensionStore
      .getState()
      .boardPresets()
      .filter((b) => !seen.has(b.id));
    return [...CORE_BOARD_PRESETS, ...extra];
  }, [enabledIds]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setBusy(false);
    const t = window.setTimeout(() => nameRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.clearTimeout(t);
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
      });
      onClose();
      await openFolderAt(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project.");
      setBusy(false);
    }
  };

  return (
    <div
      className="absolute inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-[12vh]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="New PlatformIO Project"
        className="flex w-full max-w-md flex-col overflow-hidden rounded border border-aether-border bg-aether-surface shadow-2xl"
      >
        <header className="flex h-10 shrink-0 items-center justify-between border-b border-aether-border px-3">
          <h2 className="text-sm font-medium text-aether-fg">
            New PlatformIO Project
          </h2>
          <button
            type="button"
            title="Close"
            aria-label="Close"
            disabled={busy}
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg disabled:opacity-40"
          >
            <X size={16} />
          </button>
        </header>

        <div className="flex flex-col gap-3 px-4 py-4">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wide text-aether-fg-muted">
              Parent folder
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
                title="Browse"
                onClick={() => {
                  void (async () => {
                    const picked = await pickParentFolder(
                      "Choose parent folder for the project",
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

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wide text-aether-fg-muted">
              Project name
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
              Board
            </span>
            <select
              value={board}
              onChange={(e) => setBoard(e.target.value)}
              disabled={busy}
              className="h-8 rounded border border-aether-border bg-aether-bg px-2 text-xs text-aether-fg outline-none focus:border-aether-accent"
            >
              {boardPresets.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label} ({b.id})
                </option>
              ))}
            </select>
          </label>

          {parent && name.trim() && (
            <p className="truncate text-[11px] text-aether-fg-dim" title={joinPath(parent, name.trim())}>
              → {joinPath(parent, name.trim())}
            </p>
          )}

          {error && (
            <p className="text-[11px] leading-relaxed text-aether-danger">
              {error}
            </p>
          )}

          {!isTauriRuntime() && (
            <p className="text-[11px] text-aether-warning">
              New Project requires the desktop app (`npm run tauri:dev`).
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
            Cancel
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
            {busy ? "Creating…" : "Create Project"}
          </button>
        </footer>
      </div>
    </div>
  );
}
