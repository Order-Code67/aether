import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  CloudDownload,
  FileDiff,
  GitBranch,
  GitMerge,
  Minus,
  Plus,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { cn } from "@/lib/cn";
import { basename } from "@/lib/paths";
import type { GitFileEntry } from "@/lib/git";
import { useScmStore } from "@/stores/scmStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

function FileRow({
  entry,
  staged,
  conflict,
}: {
  entry: GitFileEntry;
  staged: boolean;
  conflict?: boolean;
}) {
  const { t } = useI18n();
  const busy = useScmStore((s) => s.busy);
  const stage = useScmStore((s) => s.stage);
  const unstage = useScmStore((s) => s.unstage);
  const discard = useScmStore((s) => s.discard);
  const showDiff = useScmStore((s) => s.showDiff);
  const openFile = useScmStore((s) => s.openFile);

  return (
    <div className="group flex items-center gap-0.5 px-2 py-0.5 text-xs hover:bg-aether-surface-raised">
      <button
        type="button"
        title={
          conflict
            ? t("scm.resolveTitle")
            : `${t("scm.openFileTitle")} — ${entry.path}`
        }
        aria-label={basename(entry.path)}
        onClick={() => {
          void openFile(entry.path);
        }}
        className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
      >
        <span
          className={cn(
            "w-3 shrink-0 text-center font-mono text-[10px]",
            entry.status === "U" && "text-aether-accent",
            entry.status === "M" && "text-aether-warning",
            entry.status === "D" && "text-aether-danger",
            entry.status === "A" && "text-emerald-400",
            (entry.status === "!" || conflict) && "text-aether-warning",
          )}
        >
          {conflict ? "!" : entry.status}
        </span>
        <span className="truncate text-aether-fg">{basename(entry.path)}</span>
      </button>
      {conflict ? (
        <button
          type="button"
          title={t("scm.resolveTitle")}
          aria-label={t("scm.resolveTitle")}
          disabled={busy}
          onClick={() => {
            void openFile(entry.path);
          }}
          className="flex h-5 items-center gap-0.5 rounded px-1 text-[10px] text-aether-warning opacity-0 hover:bg-aether-surface-raised group-hover:opacity-100"
        >
          <GitMerge size={12} />
          Resolve
        </button>
      ) : (
        <>
          <button
            type="button"
            title={t("scm.diffTitle")}
            aria-label={t("scm.diffTitle")}
            disabled={busy}
            onClick={() => {
              void showDiff(entry, staged);
            }}
            className="flex h-5 w-5 items-center justify-center rounded text-aether-fg-dim opacity-0 hover:text-aether-fg group-hover:opacity-100"
          >
            <FileDiff size={12} />
          </button>
          {!staged && entry.group !== "untracked" && (
            <button
              type="button"
              title={t("scm.discardTitle")}
              aria-label={t("scm.discardTitle")}
              disabled={busy}
              onClick={() => {
                void discard([entry.path]);
              }}
              className="flex h-5 w-5 items-center justify-center rounded text-aether-fg-dim opacity-0 hover:text-aether-danger group-hover:opacity-100"
            >
              <RotateCcw size={12} />
            </button>
          )}
          <button
            type="button"
            title={staged ? t("scm.unstageTitle") : t("scm.stageTitle")}
            aria-label={staged ? t("scm.unstageTitle") : t("scm.stageTitle")}
            disabled={busy}
            onClick={() => {
              void (staged ? unstage([entry.path]) : stage([entry.path]));
            }}
            className="flex h-5 w-5 items-center justify-center rounded text-aether-fg-dim opacity-0 hover:text-aether-fg group-hover:opacity-100"
          >
            {staged ? <Minus size={12} /> : <Plus size={12} />}
          </button>
        </>
      )}
    </div>
  );
}

function Section({
  title,
  count,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  count: number;
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between px-3 py-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-aether-fg-muted">
          {title}
          <span className="ml-1 font-normal text-aether-fg-dim">{count}</span>
        </span>
        {actionLabel && onAction && (
          <button
            type="button"
            title={actionLabel}
            onClick={onAction}
            className="text-[11px] text-aether-fg-muted hover:text-aether-fg"
          >
            {actionLabel}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function BranchPanel() {
  const { t } = useI18n();
  const branches = useScmStore((s) => s.branches);
  const busy = useScmStore((s) => s.busy);
  const checkout = useScmStore((s) => s.checkout);
  const createBranch = useScmStore((s) => s.createBranch);
  const setShowBranches = useScmStore((s) => s.setShowBranches);
  const [newName, setNewName] = useState("");

  const locals = branches.filter((b) => !b.remote);
  const remotes = branches.filter((b) => b.remote);

  return (
    <div className="border-b border-aether-border">
      <div className="flex items-center gap-1 px-3 py-2">
        <input
          value={newName}
          disabled={busy}
          placeholder="New branch name"
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && newName.trim()) {
              void createBranch(newName);
              setNewName("");
            }
          }}
          className="min-w-0 flex-1 rounded border border-aether-border bg-aether-bg px-2 py-1 text-[11px] text-aether-fg outline-none focus:border-aether-accent"
        />
        <button
          type="button"
          title={t("scm.createBranchTitle")}
          aria-label={t("scm.createBranchTitle")}
          disabled={busy || !newName.trim()}
          onClick={() => {
            void createBranch(newName);
            setNewName("");
          }}
          className="rounded border border-aether-border px-2 py-1 text-[11px] text-aether-fg hover:bg-aether-surface-raised disabled:opacity-40"
        >
          Create
        </button>
        <button
          type="button"
          title={t("scm.closeBranchesTitle")}
          aria-label={t("scm.closeBranchesTitle")}
          onClick={() => setShowBranches(false)}
          className="text-[11px] text-aether-fg-muted hover:text-aether-fg"
        >
          Close
        </button>
      </div>
      <div className="aether-scroll max-h-40 overflow-auto pb-2">
        {locals.length > 0 && (
          <p className="px-3 py-1 text-[10px] uppercase tracking-wide text-aether-fg-dim">
            Local
          </p>
        )}
        {locals.map((b) => (
          <button
            key={b.name}
            type="button"
            disabled={busy || b.current}
            onClick={() => {
              void checkout(b.name);
            }}
            className={cn(
              "flex w-full items-center gap-1.5 px-3 py-1 text-left text-xs hover:bg-aether-surface-raised disabled:opacity-60",
              b.current ? "text-aether-fg" : "text-aether-fg-muted",
            )}
          >
            <GitBranch size={12} className="shrink-0" />
            <span className="truncate">{b.name}</span>
            {b.current && (
              <span className="text-[10px] text-aether-accent">current</span>
            )}
          </button>
        ))}
        {remotes.length > 0 && (
          <p className="px-3 py-1 text-[10px] uppercase tracking-wide text-aether-fg-dim">
            Remote
          </p>
        )}
        {remotes.map((b) => (
          <button
            key={b.name}
            type="button"
            disabled={busy}
            onClick={() => {
              void checkout(b.name);
            }}
            className="flex w-full items-center gap-1.5 px-3 py-1 text-left text-xs text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg"
          >
            <GitBranch size={12} className="shrink-0 opacity-60" />
            <span className="truncate">{b.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function SourceControlPanel() {
  const { t } = useI18n();
  const info = useScmStore((s) => s.info);
  const status = useScmStore((s) => s.status);
  const message = useScmStore((s) => s.message);
  const busy = useScmStore((s) => s.busy);
  const error = useScmStore((s) => s.error);
  const infoMessage = useScmStore((s) => s.infoMessage);
  const diffText = useScmStore((s) => s.diffText);
  const diffPath = useScmStore((s) => s.diffPath);
  const showBranches = useScmStore((s) => s.showBranches);
  const setMessage = useScmStore((s) => s.setMessage);
  const setShowBranches = useScmStore((s) => s.setShowBranches);
  const refresh = useScmStore((s) => s.refresh);
  const commit = useScmStore((s) => s.commit);
  const stageAll = useScmStore((s) => s.stageAll);
  const unstageAll = useScmStore((s) => s.unstageAll);
  const clearDiff = useScmStore((s) => s.clearDiff);
  const fetchRemote = useScmStore((s) => s.fetch);
  const pull = useScmStore((s) => s.pull);
  const push = useScmStore((s) => s.push);
  const kind = useWorkspaceStore((s) => s.kind);
  const rootPath = useWorkspaceStore((s) => s.rootPath);
  const folderKey = useWorkspaceStore((s) =>
    s.folders.map((f) => f.path).join("\0"),
  );

  useEffect(() => {
    void refresh();
  }, [kind, rootPath, folderKey, refresh]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-9 shrink-0 items-center justify-between px-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-aether-fg-muted">
          Source Control
        </h2>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            title={t("scm.fetchTitle")}
            aria-label={t("scm.fetchTitle")}
            disabled={busy || !status?.isRepo}
            onClick={() => {
              void fetchRemote();
            }}
            className="flex h-6 w-6 items-center justify-center rounded text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg disabled:opacity-40"
          >
            <CloudDownload size={13} />
          </button>
          <button
            type="button"
            title={t("scm.pullTitle")}
            aria-label={t("scm.pullTitle")}
            disabled={busy || !status?.isRepo}
            onClick={() => {
              void pull();
            }}
            className="flex h-6 w-6 items-center justify-center rounded text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg disabled:opacity-40"
          >
            <ArrowDown size={13} />
          </button>
          <button
            type="button"
            title={t("scm.pushTitle")}
            aria-label={t("scm.pushTitle")}
            disabled={busy || !status?.isRepo}
            onClick={() => {
              void push();
            }}
            className="flex h-6 w-6 items-center justify-center rounded text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg disabled:opacity-40"
          >
            <ArrowUp size={13} />
          </button>
          <button
            type="button"
            title={t("scm.refreshTitle")}
            aria-label={t("scm.refreshTitle")}
            disabled={busy}
            onClick={() => {
              void refresh();
            }}
            className="flex h-6 w-6 items-center justify-center rounded text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg disabled:opacity-40"
          >
            <RefreshCw size={13} className={busy ? "animate-spin" : undefined} />
          </button>
        </div>
      </header>

      {kind !== "folder" ? (
        <p className="px-3 text-xs text-aether-fg-dim">
          Open a folder to use Source Control.
        </p>
      ) : !info?.installed ? (
        <p className="px-3 text-xs text-aether-fg-dim">
          Install Git and ensure <code className="text-aether-fg">git</code> is
          on PATH.
        </p>
      ) : status && !status.isRepo ? (
        <p className="px-3 text-xs text-aether-fg-dim">
          Active folder is not a Git repository. Pin a repo root or run{" "}
          <code className="text-aether-fg">git init</code> in Terminal.
        </p>
      ) : (
        <>
          <div className="border-b border-aether-border px-2 py-1.5">
            <button
              type="button"
              title={t("scm.branchTitle")}
              aria-label={t("scm.branchTitle")}
              disabled={busy}
              onClick={() => setShowBranches(!showBranches)}
              className="flex w-full items-center gap-1.5 rounded px-1 py-1 text-left text-xs text-aether-fg hover:bg-aether-surface-raised"
            >
              <GitBranch size={13} className="shrink-0 text-aether-fg-muted" />
              <span className="min-w-0 flex-1 truncate font-medium">
                {status?.branch ?? "…"}
              </span>
              {(status?.ahead ?? 0) > 0 && (
                <span className="text-aether-fg-dim">↑{status!.ahead}</span>
              )}
              {(status?.behind ?? 0) > 0 && (
                <span className="text-aether-fg-dim">↓{status!.behind}</span>
              )}
              <ChevronDown
                size={13}
                className={cn(
                  "shrink-0 text-aether-fg-dim transition-transform",
                  showBranches && "rotate-180",
                )}
              />
            </button>
          </div>

          {showBranches && <BranchPanel />}

          <div className="space-y-1 border-b border-aether-border px-3 py-2">
            <textarea
              value={message}
              rows={3}
              disabled={busy}
              placeholder="Commit message"
              onChange={(e) => setMessage(e.target.value)}
              className="aether-scroll w-full resize-none rounded border border-aether-border bg-aether-bg px-2 py-1.5 text-xs text-aether-fg outline-none focus:border-aether-accent disabled:opacity-50"
            />
            <button
              type="button"
              title={t("scm.commitTitle")}
              aria-label={t("scm.commitTitle")}
              disabled={
                busy || !message.trim() || (status?.staged.length ?? 0) === 0
              }
              onClick={() => {
                void commit();
              }}
              className="flex w-full items-center justify-center gap-1.5 rounded bg-aether-accent px-2 py-1.5 text-xs text-white hover:opacity-90 disabled:opacity-40"
            >
              <Check size={13} />
              Commit
              {(status?.staged.length ?? 0) > 0
                ? ` (${status!.staged.length})`
                : ""}
            </button>
          </div>

          <div className="aether-scroll min-h-0 flex-1 overflow-auto py-1">
            <Section title="Merge Conflicts" count={status?.unmerged?.length ?? 0}>
              {(status?.unmerged ?? []).map((entry) => (
                <FileRow
                  key={`c:${entry.path}`}
                  entry={entry}
                  staged={false}
                  conflict
                />
              ))}
            </Section>
            <Section
              title="Staged"
              count={status?.staged.length ?? 0}
              actionLabel={t("scm.unstageAllTitle")}
              onAction={() => {
                void unstageAll();
              }}
            >
              {status?.staged.map((entry) => (
                <FileRow key={`s:${entry.path}`} entry={entry} staged />
              ))}
            </Section>
            <Section
              title="Changes"
              count={status?.unstaged.length ?? 0}
              actionLabel={t("scm.stageAllTitle")}
              onAction={() => {
                void stageAll();
              }}
            >
              {status?.unstaged.map((entry) => (
                <FileRow key={`u:${entry.path}`} entry={entry} staged={false} />
              ))}
            </Section>
            <Section
              title="Untracked"
              count={status?.untracked.length ?? 0}
              actionLabel={t("scm.stageAllTitle")}
              onAction={() => {
                void stageAll();
              }}
            >
              {status?.untracked.map((entry) => (
                <FileRow key={`t:${entry.path}`} entry={entry} staged={false} />
              ))}
            </Section>
            {status &&
              status.staged.length === 0 &&
              status.unstaged.length === 0 &&
              status.untracked.length === 0 &&
              (status.unmerged?.length ?? 0) === 0 && (
                <p className="px-3 py-2 text-xs text-aether-fg-dim">
                  No changes in the working tree.
                </p>
              )}
          </div>

          {diffText !== null && (
            <div className="flex max-h-[40%] min-h-0 flex-col border-t border-aether-border">
              <div className="flex shrink-0 items-center justify-between px-3 py-1">
                <span className="truncate text-[11px] text-aether-fg-muted">
                  Diff · {diffPath}
                </span>
                <button
                  type="button"
                  title={t("scm.closeDiffTitle")}
                  aria-label={t("scm.closeDiffTitle")}
                  onClick={clearDiff}
                  className="text-[11px] text-aether-fg-muted hover:text-aether-fg"
                >
                  Close
                </button>
              </div>
              <pre className="aether-scroll min-h-0 flex-1 overflow-auto px-3 pb-2 font-mono text-[10px] leading-4 text-aether-fg-muted whitespace-pre-wrap">
                {diffText}
              </pre>
            </div>
          )}
        </>
      )}

      {(error || infoMessage) && (
        <div
          className={cn(
            "border-t border-aether-border px-3 py-1.5 text-[11px]",
            error ? "text-aether-danger" : "text-aether-fg-muted",
          )}
        >
          {error ?? infoMessage}
        </div>
      )}
    </div>
  );
}
