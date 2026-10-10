import { EncryptDialog } from "@/components/editor/EncryptDialog";
import { useEditorStore } from "@/stores/editorStore";
import { useUnlockStore } from "@/stores/unlockStore";

/** Global gate: opens unlock dialog when an encrypted file is opened. */
export function UnlockGate() {
  const path = useUnlockStore((s) => s.path);
  const payload = useUnlockStore((s) => s.payload);
  const clear = useUnlockStore((s) => s.clear);

  if (!path || !payload) return null;

  return (
    <EncryptDialog
      mode="unlock"
      path={path}
      encryptedPayload={payload}
      onClose={clear}
      onUnlocked={(plain) => {
        useEditorStore.getState().openFile({
          path,
          content: plain,
          encrypted: true,
        });
        clear();
      }}
    />
  );
}