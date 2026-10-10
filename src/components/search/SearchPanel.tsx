import { useEffect, useMemo, useRef } from "react";
import { CaseSensitive, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { groupHitsByFile, useSearchStore } from "@/stores/searchStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export function SearchPanel() {
  const query = useSearchStore((s) => s.query);
  const caseSensitive = useSearchStore((s) => s.caseSensitive);
  const includeExtensions = useSearchStore((s) => s.includeExtensions);
  const hits = useSearchStore((s) => s.hits);
  const truncated = useSearchStore((s) => s.truncated);
  const filesScanned = useSearchStore((s) => s.filesScanned);
  const busy = useSearchStore((s) => s.busy);
  const error = useSearchStore((s) => s.error);
  const setQuery = useSearchStore((s) => s.setQuery);
  const setCaseSensitive = useSearchStore((s) => s.setCaseSensitive);
  const setIncludeExtensions = useSearchStore((s) => s.setIncludeExtensions);
  const run = useSearchStore((s) => s.run);
  const openHit = useSearchStore((s) => s.openHit);
  const kind = useWorkspaceStore((s) => s.kind);
  const folderCount = useWorkspaceStore((s) => s.folders.length);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | null>(null);

  const groups = useMemo(() => groupHitsByFile(hits), [hits]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }
    if (!query.trim()) {
      useSearchStore.getState().clear();
      return;
    }
    debounceRef.current = window.setTimeout(() => {
      void run();
    }, 280);
    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, [query, caseSensitive, includeExtensions, kind, folderCount, run]);

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      data-aether-focus-surface="search"
    >
      <header className="flex h-9 shrink-0 items-center px-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-aether-fg-muted">
          Search
        </h2>
      </header>

      <div className="space-y-2 border-b border-aether-border px-3 pb-3">
        <div className="flex items-center gap-1">
          <div className="relative min-w-0 flex-1">
            <Search
              size={13}
              className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-aether-fg-dim"
            />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void run();
                }
              }}
              placeholder="Search in workspace"
              className="w-full rounded border border-aether-border bg-aether-bg py-1.5 pl-7 pr-2 text-xs text-aether-fg outline-none focus:border-aether-accent"
            />
          </div>
          <button
            type="button"
            title="Match Case"
            aria-pressed={caseSensitive}
            onClick={() => setCaseSensitive(!caseSensitive)}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded border border-aether-border text-aether-fg-muted hover:text-aether-fg",
              caseSensitive && "border-aether-accent bg-aether-accent-muted text-aether-fg",
            )}
          >
            <CaseSensitive size={14} />
          </button>
        </div>
        <input
          value={includeExtensions}
          onChange={(e) => setIncludeExtensions(e.target.value)}
          placeholder="files to include (e.g. cpp,h,ini)"
          className="w-full rounded border border-aether-border bg-aether-bg px-2 py-1 text-[11px] text-aether-fg outline-none focus:border-aether-accent"
        />
        <p className="text-[11px] text-aether-fg-dim">
          {kind !== "folder"
            ? "Open a folder to search."
            : busy
              ? "Searching…"
              : hits.length === 0 && query.trim()
                ? `No results · ${filesScanned} files`
                : hits.length > 0
                  ? `${hits.length} result${hits.length === 1 ? "" : "s"} in ${groups.length} file${groups.length === 1 ? "" : "s"}${truncated ? " (truncated)" : ""} · ${filesScanned} scanned`
                  : `${folderCount} folder${folderCount === 1 ? "" : "s"}`}
        </p>
      </div>

      <div className="aether-scroll min-h-0 flex-1 overflow-auto py-1">
        {error && (
          <p className="px-3 py-2 text-[11px] text-aether-danger">{error}</p>
        )}
        {!error &&
          groups.map((group) => (
            <div key={group.path} className="mb-1">
              <div
                className="truncate px-3 py-1 text-[11px] font-medium text-aether-fg"
                title={group.path}
              >
                {group.name}
                <span className="ml-1 font-normal text-aether-fg-dim">
                  {group.hits.length}
                </span>
              </div>
              {group.hits.map((hit) => (
                <button
                  key={`${hit.path}:${hit.line}:${hit.column}:${hit.preview}`}
                  type="button"
                  onClick={() => {
                    void openHit(hit);
                  }}
                  className="flex w-full flex-col gap-0.5 px-3 py-1 text-left hover:bg-aether-surface-raised"
                >
                  <span className="truncate font-mono text-[11px] text-aether-fg">
                    {hit.preview.trim() || "(empty line)"}
                  </span>
                  <span className="text-[10px] text-aether-fg-dim">
                    Ln {hit.line}
                  </span>
                </button>
              ))}
            </div>
          ))}
      </div>
    </div>
  );
}
