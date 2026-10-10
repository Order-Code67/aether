import { useState } from "react";
import { useI18n } from "@/hooks/useI18n";
import type { MessageKey } from "@/i18n";
import {
  useFirmwareProfileStore,
  type FirmwareProfile,
} from "@/stores/firmwareProfileStore";
import { usePlatformIoStore } from "@/stores/platformioStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export function FirmwareProfilesSection() {
  const { t } = useI18n();
  const profiles = useFirmwareProfileStore((s) => s.profiles);
  const saveCurrentAs = useFirmwareProfileStore((s) => s.saveCurrentAs);
  const deleteProfile = useFirmwareProfileStore((s) => s.deleteProfile);
  const applyProfile = useFirmwareProfileStore((s) => s.applyProfile);
  const renameProfile = useFirmwareProfileStore((s) => s.renameProfile);
  const isProject = usePlatformIoStore((s) => s.isProject);
  const kind = useWorkspaceStore((s) => s.kind);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const canSave = kind === "folder" && isProject;

  return (
    <div className="space-y-2 border-t border-aether-border pt-3">
      <p className="font-medium text-aether-fg">{t("profiles.title")}</p>
      <p className="text-[11px] text-aether-fg-muted">{t("profiles.hint")}</p>

      <div className="flex flex-wrap items-center gap-1.5">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("profiles.namePlaceholder")}
          disabled={!canSave}
          className="h-7 min-w-[140px] flex-1 rounded border border-aether-border bg-aether-bg px-2 text-[11px] text-aether-fg outline-none focus:border-aether-accent disabled:opacity-40"
        />
        <button
          type="button"
          disabled={!canSave || !name.trim()}
          onClick={() => {
            const id = saveCurrentAs(name.trim());
            if (id) setName("");
          }}
          className="h-7 rounded border border-aether-border px-2 text-[11px] text-aether-fg hover:bg-aether-surface-raised disabled:opacity-40"
        >
          {t("profiles.saveCurrent")}
        </button>
      </div>

      {profiles.length === 0 ? (
        <p className="text-[11px] text-aether-fg-dim">{t("profiles.empty")}</p>
      ) : (
        <ul className="space-y-1">
          {profiles.map((p) => (
            <ProfileRow
              key={p.id}
              profile={p}
              editing={editingId === p.id}
              editName={editName}
              onEditName={setEditName}
              onStartEdit={() => {
                setEditingId(p.id);
                setEditName(p.name);
              }}
              onCancelEdit={() => setEditingId(null)}
              onCommitEdit={() => {
                renameProfile(p.id, editName);
                setEditingId(null);
              }}
              onApply={() => void applyProfile(p.id)}
              onDelete={() => deleteProfile(p.id)}
              t={t}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ProfileRow({
  profile,
  editing,
  editName,
  onEditName,
  onStartEdit,
  onCancelEdit,
  onCommitEdit,
  onApply,
  onDelete,
  t,
}: {
  profile: FirmwareProfile;
  editing: boolean;
  editName: string;
  onEditName: (v: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onCommitEdit: () => void;
  onApply: () => void;
  onDelete: () => void;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
}) {
  return (
    <li className="flex flex-wrap items-center gap-1 rounded border border-aether-border/60 px-2 py-1.5">
      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            value={editName}
            onChange={(e) => onEditName(e.target.value)}
            className="h-6 w-full rounded border border-aether-border bg-aether-bg px-1 text-[11px] text-aether-fg"
          />
        ) : (
          <>
            <p className="truncate text-[11px] font-medium text-aether-fg">
              {profile.name}
            </p>
            <p className="truncate font-mono text-[10px] text-aether-fg-dim">
              {profile.env || "—"} · {profile.uploadPort || "—"}
              {profile.monitorBaud ? ` · ${profile.monitorBaud}` : ""}
            </p>
          </>
        )}
      </div>
      {editing ? (
        <>
          <button
            type="button"
            onClick={onCommitEdit}
            className="h-6 rounded px-1.5 text-[10px] text-aether-fg hover:bg-aether-surface-raised"
          >
            {t("profiles.rename")}
          </button>
          <button
            type="button"
            onClick={onCancelEdit}
            className="h-6 rounded px-1.5 text-[10px] text-aether-fg-muted"
          >
            {t("settings.close")}
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={onApply}
            className="h-6 rounded border border-aether-border px-1.5 text-[10px] text-aether-fg hover:bg-aether-surface-raised"
          >
            {t("profiles.apply")}
          </button>
          <button
            type="button"
            onClick={onStartEdit}
            className="h-6 rounded px-1.5 text-[10px] text-aether-fg-muted hover:text-aether-fg"
          >
            {t("profiles.rename")}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="h-6 rounded px-1.5 text-[10px] text-aether-danger hover:bg-aether-surface-raised"
          >
            {t("profiles.delete")}
          </button>
        </>
      )}
    </li>
  );
}
