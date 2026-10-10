import { useMemo, useState, type ReactNode } from "react";
import { PackagePlus, Save, Trash2, Upload } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  draftFromManifest,
  emptyDraft,
  validateDraft,
  type PublishDraft,
} from "@/lib/extensionPublisher";
import { isTauriRuntime } from "@/lib/tauri";
import { useExtensionStore } from "@/stores/extensionStore";
import type { ExtensionCategory, ExtensionSnippet } from "@/types/extensions";

const CATEGORIES: ExtensionCategory[] = [
  "snippets",
  "boards",
  "languages",
  "themes",
  "other",
];

export function PublishPanel() {
  const hubEntries = useExtensionStore((s) => s.hubEntries);
  const localExtensions = useExtensionStore((s) => s.localExtensions);
  const publishToHub = useExtensionStore((s) => s.publishToHub);
  const unpublishFromHub = useExtensionStore((s) => s.unpublishFromHub);
  const exportPackage = useExtensionStore((s) => s.exportPackage);
  const exportHubCatalog = useExtensionStore((s) => s.exportHubCatalog);
  const error = useExtensionStore((s) => s.error);
  const publishMessage = useExtensionStore((s) => s.publishMessage);

  const [draft, setDraft] = useState<PublishDraft>(emptyDraft);
  const [snippetLabel, setSnippetLabel] = useState("");
  const [snippetBody, setSnippetBody] = useState("");
  const [boardId, setBoardId] = useState("");
  const [boardLabel, setBoardLabel] = useState("");
  const [busy, setBusy] = useState(false);

  const validation = useMemo(() => validateDraft(draft), [draft]);

  const patch = (partial: Partial<PublishDraft>) =>
    setDraft((d) => ({ ...d, ...partial }));

  const addSnippet = () => {
    if (!snippetLabel.trim() || !snippetBody.trim()) return;
    const snip: ExtensionSnippet = {
      label: snippetLabel.trim(),
      insertText: snippetBody,
      detail: snippetLabel.trim(),
    };
    patch({ snippets: [...draft.snippets, snip] });
    setSnippetLabel("");
    setSnippetBody("");
  };

  const addBoard = () => {
    if (!boardId.trim() || !boardLabel.trim()) return;
    patch({
      boards: [
        ...draft.boards,
        { id: boardId.trim(), label: boardLabel.trim() },
      ],
    });
    setBoardId("");
    setBoardLabel("");
  };

  return (
    <div className="aether-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-auto px-3 py-2">
      <p className="text-[11px] leading-relaxed text-aether-fg-dim">
        Author an extension, publish it to the <strong>local hub</strong>{" "}
        (appears in Marketplace), export a folder package, or export{" "}
        <span className="font-mono">catalog.json</span> for hosting.
      </p>

      {localExtensions.length > 0 && (
        <label className="flex flex-col gap-1 text-[11px] text-aether-fg-muted">
          Load draft from installed local extension
          <select
            className="h-7 rounded border border-aether-border bg-aether-bg px-1 text-xs text-aether-fg"
            defaultValue=""
            onChange={(e) => {
              const m = localExtensions.find((x) => x.id === e.target.value);
              if (m) setDraft(draftFromManifest(m));
            }}
          >
            <option value="">—</option>
            {localExtensions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.id})
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Field label="Id" value={draft.id} onChange={(v) => patch({ id: v })} />
        <Field
          label="Version"
          value={draft.version}
          onChange={(v) => patch({ version: v })}
        />
        <Field
          label="Name"
          value={draft.name}
          onChange={(v) => patch({ name: v })}
        />
        <Field
          label="Publisher"
          value={draft.publisher}
          onChange={(v) => patch({ publisher: v })}
        />
      </div>

      <label className="flex flex-col gap-1 text-[11px] text-aether-fg-muted">
        Category
        <select
          value={draft.category}
          onChange={(e) =>
            patch({ category: e.target.value as ExtensionCategory })
          }
          className="h-7 rounded border border-aether-border bg-aether-bg px-1 text-xs text-aether-fg"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-[11px] text-aether-fg-muted">
        Description
        <textarea
          value={draft.description}
          onChange={(e) => patch({ description: e.target.value })}
          rows={2}
          className="rounded border border-aether-border bg-aether-bg px-2 py-1 text-xs text-aether-fg outline-none focus:border-aether-accent"
        />
      </label>

      <Field
        label="Public download URL (optional https://…/extension.json)"
        value={draft.downloadUrl}
        onChange={(v) => patch({ downloadUrl: v })}
      />

      <section className="rounded border border-aether-border/60 p-2">
        <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-aether-fg-muted">
          Snippets ({draft.snippets.length})
        </h3>
        <div className="mb-2 flex flex-col gap-1">
          <input
            value={snippetLabel}
            onChange={(e) => setSnippetLabel(e.target.value)}
            placeholder="label (e.g. blink)"
            className="h-7 rounded border border-aether-border bg-aether-bg px-2 text-xs text-aether-fg"
          />
          <textarea
            value={snippetBody}
            onChange={(e) => setSnippetBody(e.target.value)}
            placeholder="insertText (Monaco snippet)"
            rows={3}
            className="rounded border border-aether-border bg-aether-bg px-2 py-1 font-mono text-[11px] text-aether-fg"
          />
          <button
            type="button"
            onClick={addSnippet}
            className="self-start rounded border border-aether-border px-2 py-1 text-[11px] text-aether-fg hover:bg-aether-surface-raised"
          >
            Add snippet
          </button>
        </div>
        {draft.snippets.map((s, i) => (
          <div
            key={`${s.label}-${i}`}
            className="mb-1 flex items-center gap-1 text-[11px]"
          >
            <span className="min-w-0 flex-1 truncate text-aether-fg">
              {s.label}
            </span>
            <button
              type="button"
              onClick={() =>
                patch({
                  snippets: draft.snippets.filter((_, j) => j !== i),
                })
              }
              className="text-aether-danger"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </section>

      <section className="rounded border border-aether-border/60 p-2">
        <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-aether-fg-muted">
          Boards ({draft.boards.length})
        </h3>
        <div className="mb-2 flex gap-1">
          <input
            value={boardId}
            onChange={(e) => setBoardId(e.target.value)}
            placeholder="board id"
            className="h-7 min-w-0 flex-1 rounded border border-aether-border bg-aether-bg px-2 text-xs text-aether-fg"
          />
          <input
            value={boardLabel}
            onChange={(e) => setBoardLabel(e.target.value)}
            placeholder="label"
            className="h-7 min-w-0 flex-1 rounded border border-aether-border bg-aether-bg px-2 text-xs text-aether-fg"
          />
          <button
            type="button"
            onClick={addBoard}
            className="rounded border border-aether-border px-2 text-[11px] text-aether-fg hover:bg-aether-surface-raised"
          >
            Add
          </button>
        </div>
        {draft.boards.map((b, i) => (
          <div key={`${b.id}-${i}`} className="flex items-center gap-1 text-[11px]">
            <span className="min-w-0 flex-1 truncate text-aether-fg">
              {b.label} ({b.id})
            </span>
            <button
              type="button"
              onClick={() =>
                patch({ boards: draft.boards.filter((_, j) => j !== i) })
              }
              className="text-aether-danger"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </section>

      {!validation.ok && (
        <ul className="list-inside list-disc text-[11px] text-aether-danger">
          {validation.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {validation.warnings.map((w) => (
        <p key={w} className="text-[11px] text-aether-warning">
          {w}
        </p>
      ))}
      {error && <p className="text-[11px] text-aether-danger">{error}</p>}
      {publishMessage && (
        <p className="text-[11px] text-aether-success">{publishMessage}</p>
      )}

      <div className="flex flex-wrap gap-1">
        <ActionBtn
          icon={<Upload size={13} />}
          label={busy ? "…" : "Publish to Hub"}
          primary
          disabled={!isTauriRuntime() || busy || !validation.ok}
          onClick={() => {
            setBusy(true);
            void publishToHub(draft).finally(() => setBusy(false));
          }}
        />
        <ActionBtn
          icon={<PackagePlus size={13} />}
          label="Export Package…"
          disabled={!isTauriRuntime() || busy || !validation.ok}
          onClick={() => {
            setBusy(true);
            void exportPackage(draft).finally(() => setBusy(false));
          }}
        />
        <ActionBtn
          icon={<Save size={13} />}
          label="Export Hub Catalog…"
          disabled={!isTauriRuntime() || busy || hubEntries.length === 0}
          onClick={() => {
            setBusy(true);
            void exportHubCatalog().finally(() => setBusy(false));
          }}
        />
        <ActionBtn
          label="Reset draft"
          disabled={busy}
          onClick={() => setDraft(emptyDraft())}
        />
      </div>

      <section>
        <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-aether-fg-muted">
          Local hub ({hubEntries.length})
        </h3>
        {hubEntries.length === 0 ? (
          <p className="text-[11px] text-aether-fg-dim">
            No published packages yet.
          </p>
        ) : (
          hubEntries.map((e) => (
            <div
              key={e.id}
              className="mb-1 flex items-start gap-2 rounded border border-aether-border/50 px-2 py-1.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-aether-fg">{e.name}</p>
                <p className="truncate text-[11px] text-aether-fg-dim">
                  {e.id}
                  {e.contentHash
                    ? ` · sha256:${e.contentHash.slice(0, 8)}…`
                    : ""}
                </p>
              </div>
              <button
                type="button"
                title="Unpublish"
                onClick={() => unpublishFromHub(e.id)}
                className="text-aether-danger"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-[11px] text-aether-fg-muted">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 rounded border border-aether-border bg-aether-bg px-2 text-xs text-aether-fg outline-none focus:border-aether-accent"
      />
    </label>
  );
}

function ActionBtn({
  label,
  onClick,
  disabled,
  primary,
  icon,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-7 items-center gap-1 rounded px-2 text-[11px]",
        primary
          ? "bg-aether-accent font-medium text-white hover:opacity-90"
          : "border border-aether-border text-aether-fg hover:bg-aether-surface-raised",
        "disabled:opacity-40",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
