import { useState } from "react";
import { useI18n } from "@/hooks/useI18n";
import type { MessageKey } from "@/i18n";
import {
  exportFirmwareProfilesToFile,
  importFirmwareProfilesFromFile,
} from "@/lib/firmwareProfilesFile";
import { isTauriRuntime } from "@/lib/tauri";
import {
  useFirmwareProfileStore,
  type FirmwareProfile,
} from "@/stores/firmwareProfileStore";
import { usePlatformIoStore } from "@/stores/platformioStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export function FirmwareProfilesSection() {
  const { t, locale } = useI18n();
  const profiles = useFirmwareProfileStore((s) => s.profiles);
  const saveCurrentAs = useFirmwareProfileStore((s) => s.saveCurrentAs);
  const deleteProfile = useFirmwareProfileStore((s) => s.deleteProfile);
  const applyProfile = useFirmwareProfileStore((s) => s.applyProfile);
  const renameProfile = useFirmwareProfileStore((s) => s.renameProfile);
  const replaceProfiles = useFirmwareProfileStore((s) => s.replaceProfiles);
  const mergeProfiles = useFirmwareProfileStore((s) => s.mergeProfiles);
  const isProject = usePlatformIoStore((s) => s.isProject);
  const kind = useWorkspaceStore((s) => s.kind);
  const flashNotice = useSettingsStore((s) => s.flashNotice);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const canSave = kind === "folder" && isProject;
  const selectedIds = profiles.filter((p) => selected[p.id]).map((p) => p.id);
  const exportList =
    selectedIds.length > 0
      ? profiles.filter((p) => selected[p.id])
      : profiles;

  const toggleSelect = (id: string) =>
    setSelected((s) => ({ ...s, [id]: !s[id] }));

  const onExport = async () => {
    if (!isTauriRuntime()) {
      flashNotice(t("profiles.desktopOnly"));
      return;
    }
    if (exportList.length === 0) {
      flashNotice(t("profiles.empty"));
      return;
    }
    setBusy(true);
    try {
      const path = await exportFirmwareProfilesToFile(exportList, locale);
      if (path) {
        flashNotice(
          t("profiles.exported", { count: exportList.length }),
          3500,
        );
      }
    } catch (e) {
      flashNotice(e instanceof Error ? e.message : t("profiles.exportFailed"));
    } finally {
      setBusy(false);
    }
  };

  const onImport = async () => {
    if (!isTauriRuntime()) {
      flashNotice(t("profiles.desktopOnly"));
      return;
    }
    setBusy(true);
    try {
      const result = await importFirmwareProfilesFromFile(locale);
      if (!result.ok) {
        if ("cancelled" in result && result.cancelled) return;
        if ("errorKey" in result) {
          flashNotice(t(result.errorKey));
        }
        return;
      }
      // OK = replace all; Cancel = merge by id
      const replace = window.confirm(t("profiles.importConfirm"));
      if (replace) {
        replaceProfiles(result.profiles);
      } else {
        mergeProfiles(result.profiles);
      }
      flashNotice(
        t("profiles.imported", { count: result.profiles.length }),
        3500,
      );
    } catch (e) {
      flashNotice(e instanceof Error ? e.message : t("profiles.importFailed"));
    } finally {
      setBusy(false);
    }
  };

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

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          disabled={busy || profiles.length === 0}
          onClick={() => void onExport()}
          className="h-7 rounded border border-aether-border px-2 text-[11px] text-aether-fg hover:bg-aether-surface-raised disabled:opacity-40"
        >
          {selectedIds.length > 0
            ? t("profiles.exportSelected", { count: selectedIds.length })
            : t("profiles.export")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onImport()}
          className="h-7 rounded border border-aether-border px-2 text-[11px] text-aether-fg hover:bg-aether-surface-raised disabled:opacity-40"
        >
          {t("profiles.import")}
        </button>
        <span className="text-[10px] text-aether-fg-dim">
          {t("profiles.exportHint")}
        </span>
      </div>

      {profiles.length === 0 ? (
        <p className="text-[11px] text-aether-fg-dim">{t("profiles.empty")}</p>
      ) : (
        <ul className="space-y-1">
          {profiles.map((p) => (
            <ProfileRow
              key={p.id}
              profile={p}
              selected={!!selected[p.id]}
              onToggleSelect={() => toggleSelect(p.id)}
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
  selected,
  onToggleSelect,
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
  selected: boolean;
  onToggleSelect: () => void;
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
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggleSelect}
        title={t("profiles.selectForExport")}
        className="shrink-0"
      />
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
