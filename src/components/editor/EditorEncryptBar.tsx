import { useState } from "react";
import { Lock, LockOpen, ShieldOff } from "lucide-react";
import {
  EncryptDialog,
  removeEncryptionFromActiveTab,
  type EncryptDialogMode,
} from "@/components/editor/EncryptDialog";
import { useI18n } from "@/hooks/useI18n";
import { useEditorStore } from "@/stores/editorStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export function EditorEncryptBar() {
  const { t } = useI18n();
  const kind = useWorkspaceStore((s) => s.kind);
  const activeTab = useEditorStore((s) => {
    const id = s.activeTabId;
    return s.tabs.find((tab) => tab.id === id) ?? null;
  });
  const [mode, setMode] = useState<EncryptDialogMode>(null);

  if (kind !== "folder" || !activeTab) return null;

  return (
    <>
      <div className="flex h-7 shrink-0 items-center gap-1 border-b border-aether-border bg-aether-activity px-2">
        {activeTab.encrypted ? (
          <>
            <span className="mr-auto truncate text-[11px] text-aether-warning">
              {t("encrypt.lockedBanner")}
            </span>
            <button
              type="button"
              title={t("encrypt.remove")}
              onClick={() => {
                void removeEncryptionFromActiveTab();
              }}
              className="flex h-6 items-center gap-1 rounded px-1.5 text-[11px] text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg"
            >
              <ShieldOff size={12} />
              {t("encrypt.remove")}
            </button>
          </>
        ) : (
          <button
            type="button"
            title={t("encrypt.lock")}
            onClick={() => setMode("lock")}
            className="flex h-6 items-center gap-1 rounded px-1.5 text-[11px] text-aether-fg-muted hover:bg-aether-surface-raised hover:text-aether-fg"
          >
            <Lock size={12} />
            {t("encrypt.lock")}
          </button>
        )}
        {!activeTab.encrypted && (
          <LockOpen size={12} className="ml-auto text-aether-fg-dim" />
        )}
      </div>
      <EncryptDialog mode={mode} onClose={() => setMode(null)} />
    </>
  );
}
