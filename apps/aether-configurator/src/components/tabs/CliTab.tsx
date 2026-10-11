import { useEffect, useRef, useState } from "react";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/hooks/useI18n";
import { useConnectionStore } from "@/stores/connectionStore";

/** Minimal CLI pane — text I/O over serial. Autocomplete comes later. */
export function CliTab() {
  const { t } = useI18n();
  const connected = useConnectionStore((s) => s.connected);
  const [line, setLine] = useState("");
  const [log, setLog] = useState("");
  const preRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (!window.aether || !connected) return;
    const off = window.aether.serial.onData((data) => {
      setLog((prev) => (prev + data).slice(-20000));
    });
    return off;
  }, [connected]);

  useEffect(() => {
    if (preRef.current) {
      preRef.current.scrollTop = preRef.current.scrollHeight;
    }
  }, [log]);

  async function send() {
    if (!window.aether || !line.trim()) return;
    const cmd = line.endsWith("\n") ? line : `${line}\n`;
    setLog((prev) => prev + `> ${line}\n`);
    setLine("");
    await window.aether.serial.write(cmd);
  }

  return (
    <Card className="flex h-full min-h-[480px] flex-col">
      <CardTitle>{t("tabs.cli")}</CardTitle>
      <CardHint>{t("cli.hint")}</CardHint>
      <pre
        ref={preRef}
        className="mt-3 min-h-0 flex-1 overflow-auto rounded-md border border-border bg-[#071018] p-3 font-mono text-[11px] leading-relaxed text-[#c8e6c9]"
      >
        {log || (connected ? "" : t("connection.disconnected"))}
      </pre>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <Input
          value={line}
          onChange={(e) => setLine(e.target.value)}
          disabled={!connected}
          placeholder="status, version, diff all…"
          className="font-mono"
        />
        <Button type="submit" variant="primary" disabled={!connected}>
          {t("cli.send")}
        </Button>
      </form>
    </Card>
  );
}
