import { useEffect, useMemo, useRef, useState } from "react";
import { FileCode2, TerminalSquare } from "lucide-react";
import { getCommands, type Command } from "@/lib/commands";
import {
  expandFileIndex,
  indexLoadedFiles,
  type FileIndexEntry,
} from "@/lib/fileIndex";
import { fuzzyFilter } from "@/lib/fuzzy";
import { cn } from "@/lib/cn";
import { usePaletteStore } from "@/stores/paletteStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

const MAX_RESULTS = 80;

export function CommandPalette() {
  const isOpen = usePaletteStore((s) => s.isOpen);
  const mode = usePaletteStore((s) => s.mode);
  const query = usePaletteStore((s) => s.query);
  const recentCommandIds = usePaletteStore((s) => s.recentCommandIds);
  const setQuery = usePaletteStore((s) => s.setQuery);
  const close = usePaletteStore((s) => s.close);
  const rememberCommand = usePaletteStore((s) => s.rememberCommand);

  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState(0);
  const [files, setFiles] = useState<FileIndexEntry[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setSelected(0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(t);
  }, [isOpen, mode]);

  useEffect(() => {
    if (!isOpen || mode !== "files") return;
    let cancelled = false;
    const base = indexLoadedFiles();
    setFiles(base);
    void expandFileIndex(base).then((expanded) => {
      if (!cancelled) setFiles(expanded);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, mode]);

  const commands = useMemo(() => getCommands(), []);

  const filteredCommands = useMemo(() => {
    if (mode !== "commands") return [] as Command[];
    const list = fuzzyFilter(
      commands,
      query,
      (c) => `${c.title} ${c.category} ${c.keywords ?? ""} ${c.id}`,
    );
    if (!query.trim() && recentCommandIds.length > 0) {
      const recent = recentCommandIds
        .map((id) => commands.find((c) => c.id === id))
        .filter((c): c is Command => !!c);
      const rest = list.filter((c) => !recentCommandIds.includes(c.id));
      return [...recent, ...rest].slice(0, MAX_RESULTS);
    }
    return list.slice(0, MAX_RESULTS);
  }, [mode, commands, query, recentCommandIds]);

  const filteredFiles = useMemo(() => {
    if (mode !== "files") return [] as FileIndexEntry[];
    return fuzzyFilter(
      files,
      query,
      (f) => `${f.name} ${f.relative} ${f.path}`,
    ).slice(0, MAX_RESULTS);
  }, [mode, files, query]);

  const itemCount =
    mode === "commands" ? filteredCommands.length : filteredFiles.length;

  useEffect(() => {
    setSelected(0);
  }, [query, mode, itemCount]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((i) => Math.min(itemCount - 1, i + 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((i) => Math.max(0, i - 1));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        if (mode === "commands") {
          const cmd = filteredCommands[selected];
          if (cmd) {
            close();
            rememberCommand(cmd.id);
            void cmd.run();
          }
        } else {
          const file = filteredFiles[selected];
          if (file) {
            close();
            void useWorkspaceStore.getState().openPathInEditor(file.path);
          }
        }
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [
    isOpen,
    close,
    mode,
    selected,
    itemCount,
    filteredCommands,
    filteredFiles,
    rememberCommand,
  ]);

  if (!isOpen) return null;

  return (
    <div
      className="absolute inset-0 z-[60] flex items-start justify-center bg-black/50 px-4 pt-[12vh]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        data-testid="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label={mode === "commands" ? "Command Palette" : "Go to File"}
        className="flex w-full max-w-xl flex-col overflow-hidden rounded border border-aether-border bg-aether-surface shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-aether-border px-3 py-2">
          {mode === "commands" ? (
            <TerminalSquare size={16} className="text-aether-fg-muted" />
          ) : (
            <FileCode2 size={16} className="text-aether-fg-muted" />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              mode === "commands"
                ? "Type a command…"
                : "Search files by name…"
            }
            className="h-8 min-w-0 flex-1 bg-transparent text-sm text-aether-fg outline-none placeholder:text-aether-fg-dim"
          />
          <span className="text-[10px] uppercase tracking-wide text-aether-fg-dim">
            {mode === "commands" ? "Ctrl+Shift+P" : "Ctrl+P"}
          </span>
        </div>

        <div className="aether-scroll max-h-[50vh] overflow-auto py-1">
          {mode === "commands" &&
            filteredCommands.map((cmd, index) => (
              <button
                key={cmd.id}
                type="button"
                onMouseEnter={() => setSelected(index)}
                onClick={() => {
                  close();
                  rememberCommand(cmd.id);
                  void cmd.run();
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs",
                  index === selected
                    ? "bg-aether-accent-muted text-aether-fg"
                    : "text-aether-fg hover:bg-aether-surface-raised",
                )}
              >
                <span className="w-20 shrink-0 truncate text-[10px] uppercase tracking-wide text-aether-fg-dim">
                  {cmd.category}
                </span>
                <span className="min-w-0 flex-1 truncate">{cmd.title}</span>
                {cmd.keybinding && (
                  <span className="shrink-0 text-[10px] text-aether-fg-dim">
                    {cmd.keybinding}
                  </span>
                )}
              </button>
            ))}

          {mode === "files" &&
            filteredFiles.map((file, index) => (
              <button
                key={file.path}
                type="button"
                onMouseEnter={() => setSelected(index)}
                onClick={() => {
                  close();
                  void useWorkspaceStore
                    .getState()
                    .openPathInEditor(file.path);
                }}
                className={cn(
                  "flex w-full flex-col px-3 py-1.5 text-left",
                  index === selected
                    ? "bg-aether-accent-muted"
                    : "hover:bg-aether-surface-raised",
                )}
              >
                <span className="truncate text-xs text-aether-fg">
                  {file.name}
                </span>
                <span className="truncate text-[11px] text-aether-fg-dim">
                  {file.relative}
                </span>
              </button>
            ))}

          {itemCount === 0 && (
            <p className="px-3 py-4 text-xs text-aether-fg-dim">
              {mode === "files"
                ? "No matching files. Open a folder workspace first."
                : "No matching commands."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
