import { useState } from "react";
import { FolderOpen } from "lucide-react";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/hooks/useI18n";

interface LogInfo {
  path: string;
  size: number;
  headerPreview: string;
  likelyBlackbox: boolean;
}

function decodePreview(bytes: number[]): string {
  let s = "";
  for (let i = 0; i < Math.min(bytes.length, 240); i++) {
    const c = bytes[i]!;
    s += c >= 32 && c < 127 ? String.fromCharCode(c) : ".";
  }
  return s;
}

export function BlackboxTab() {
  const { t } = useI18n();
  const [log, setLog] = useState<LogInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function openLog() {
    setError(null);
    if (!window.aether) {
      setError("NO_BRIDGE");
      return;
    }
    const path = await window.aether.app.openFile({
      title: t("blackbox.pick"),
      filters: [
        { name: "Blackbox", extensions: ["bbl", "bfl", "txt", "log"] },
        { name: "All", extensions: ["*"] },
      ],
    });
    if (!path) return;
    const file = await window.aether.app.readFile(path);
    const headerPreview = decodePreview(file.bytes);
    const likelyBlackbox =
      /H\s|Product:|Blackbox|I\s|P\s|S\s/i.test(headerPreview) ||
      path.toLowerCase().endsWith(".bbl") ||
      path.toLowerCase().endsWith(".bfl");
    setLog({
      path: file.path,
      size: file.size,
      headerPreview,
      likelyBlackbox,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">
            {t("blackbox.title")}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-fg-muted">
            {t("blackbox.hint")}
          </p>
        </div>
        <Button variant="primary" onClick={() => void openLog()}>
          <FolderOpen className="h-3.5 w-3.5" />
          {t("blackbox.open")}
        </Button>
      </div>

      {error && (
        <Card className="border-danger/40">
          <p className="text-sm text-danger">
            {error === "NO_BRIDGE" ? t("connection.noBridge") : error}
          </p>
        </Card>
      )}

      {!log ? (
        <Card>
          <p className="text-sm text-fg-muted">{t("blackbox.empty")}</p>
        </Card>
      ) : (
        <Card>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="truncate">{log.path}</CardTitle>
            <Badge tone={log.likelyBlackbox ? "ok" : "warn"}>
              {log.likelyBlackbox ? t("blackbox.ok") : t("blackbox.unknown")}
            </Badge>
          </div>
          <CardHint className="mt-2">
            {t("blackbox.size", { size: String(log.size) })}
          </CardHint>
          <pre className="mt-3 max-h-64 overflow-auto rounded border border-border bg-surface-2 p-2 font-mono text-[11px]">
            {log.headerPreview}
          </pre>
          <p className="mt-3 text-xs text-fg-muted">{t("blackbox.note")}</p>
        </Card>
      )}
    </div>
  );
}
