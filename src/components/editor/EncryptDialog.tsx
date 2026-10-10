import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import {
  decryptSketch,
  encryptSketch,
  forgetSketchPassword,
  rememberSketchPassword,
} from "@/lib/sketchCrypto";
import { useEditorStore } from "@/stores/editorStore";

export type EncryptDialogMode = "lock" | "unlock" | null;

interface EncryptDialogProps {
  mode: EncryptDialogMode;
  /** For unlock: raw encrypted file content */
  encryptedPayload?: string;
  path?: string;
  onClose: () => void;
  onUnlocked?: (plaintext: string) => void;
}

export function EncryptDialog({
  mode,
  encryptedPayload,
  path,
  onClose,
  onUnlocked,
}: EncryptDialogProps) {
  const { t } = useI18n();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!mode) return;
    setPassword("");
    setConfirm("");
    setError(null);
    const tmr = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(tmr);
  }, [mode]);

  if (!mode) return null;

  const submit = async () => {
    setError(null);
    if (password.length < 6) {
      setError(t("encrypt.tooShort"));
      return;
    }
    if (mode === "lock" && password !== confirm) {
      setError(t("encrypt.mismatch"));
      return;
    }

    setBusy(true);
    try {
      if (mode === "unlock") {
        if (!encryptedPayload || !path) {
          setError(t("common.error"));
          return;
        }
        const plain = await decryptSketch(encryptedPayload, password);
        rememberSketchPassword(path, password);
        onUnlocked?.(plain);
        onClose();
        return;
      }

      // lock active tab
      const editor = useEditorStore.getState();
      const tab = editor.tabs.find((x) => x.id === editor.activeTabId);
      if (!tab) {
        setError(t("encrypt.needFolder"));
        return;
      }
      rememberSketchPassword(tab.path, password);
      editor.setEncrypted(tab.id, true);
      // Force dirty write of ciphertext
      useEditorStore.setState((s) => ({
        tabs: s.tabs.map((x) =>
          x.id === tab.id ? { ...x, dirty: true } : x,
        ),
      }));
      const ok = await editor.saveTab(tab.id);
      if (!ok) {
        editor.setEncrypted(tab.id, false);
        forgetSketchPassword(tab.path);
        setError(
          useEditorStore.getState().saveStatus.kind === "error"
            ? (useEditorStore.getState().saveStatus as { message: string })
                .message
            : t("common.error"),
        );
        return;
      }
      onClose();
    } catch (err) {
      setError(
        err instanceof Error && err.message.includes("Wrong")
          ? t("encrypt.badPassword")
          : err instanceof Error
            ? err.message
            : t("common.error"),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="absolute inset-0 z-[70] flex items-start justify-center bg-black/50 px-4 pt-[16vh]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm overflow-hidden rounded border border-aether-border bg-aether-surface shadow-2xl"
      >
        <header className="flex h-10 items-center justify-between border-b border-aether-border px-3">
          <h2 className="text-sm font-medium text-aether-fg">
            {mode === "lock" ? t("encrypt.title.lock") : t("encrypt.title.unlock")}
          </h2>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded text-aether-fg-muted hover:bg-aether-surface-raised"
          >
            <X size={16} />
          </button>
        </header>
        <div className="space-y-2 p-3 text-xs">
          <label className="block text-aether-fg-muted">
            {t("encrypt.password")}
            <input
              ref={inputRef}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submit();
              }}
              className="mt-0.5 h-8 w-full rounded border border-aether-border bg-aether-bg px-2 text-aether-fg outline-none focus:border-aether-accent"
            />
          </label>
          {mode === "lock" && (
            <label className="block text-aether-fg-muted">
              {t("encrypt.confirm")}
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void submit();
                }}
                className="mt-0.5 h-8 w-full rounded border border-aether-border bg-aether-bg px-2 text-aether-fg outline-none focus:border-aether-accent"
              />
            </label>
          )}
          {error && <p className="text-aether-danger">{error}</p>}
          <div className="flex justify-end gap-1 pt-1">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="rounded border border-aether-border px-2.5 py-1.5 text-aether-fg-muted hover:text-aether-fg"
            >
              {t("encrypt.cancel")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void submit()}
              className="rounded bg-aether-accent px-2.5 py-1.5 font-medium text-white hover:opacity-90"
            >
              {mode === "lock"
                ? t("encrypt.submit.lock")
                : t("encrypt.submit.unlock")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export async function removeEncryptionFromActiveTab(): Promise<boolean> {
  const editor = useEditorStore.getState();
  const tab = editor.tabs.find((x) => x.id === editor.activeTabId);
  if (!tab?.encrypted) return false;
  forgetSketchPassword(tab.path);
  editor.setEncrypted(tab.id, false);
  useEditorStore.setState((s) => ({
    tabs: s.tabs.map((x) =>
      x.id === tab.id ? { ...x, dirty: true, encrypted: false } : x,
    ),
  }));
  return editor.saveTab(tab.id);
}

// re-export for callers that encrypt on first save path
export { encryptSketch };
