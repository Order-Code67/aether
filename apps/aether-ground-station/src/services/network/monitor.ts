import { probeHost } from "@/services/hardware";
import { eventBus } from "@/services/events/eventBus";
import { deviceManager } from "@/services/devices/deviceManager";

export interface NetworkSample {
  at: string;
  ok: boolean;
  latencyMs: number | null;
  error?: string;
}

export interface MonitoredTarget {
  id: string;
  host: string;
  port: number;
  samples: NetworkSample[];
  lossRatio: number;
  avgLatencyMs: number | null;
  reconnects: number;
}

type Listener = (targets: MonitoredTarget[]) => void;

/**
 * Local Network Monitor — only user-added hosts; never auto-scans foreign nets.
 */
class NetworkMonitor {
  private targets = new Map<string, MonitoredTarget>();
  private timers = new Map<string, ReturnType<typeof setInterval>>();
  private listeners = new Set<Listener>();

  subscribe(l: Listener): () => void {
    this.listeners.add(l);
    l(this.list());
    return () => this.listeners.delete(l);
  }

  private emit(): void {
    const list = this.list();
    for (const l of this.listeners) l(list);
  }

  list(): MonitoredTarget[] {
    return [...this.targets.values()];
  }

  add(host: string, port: number, intervalMs = 5000): string {
    const id = `net:${host}:${port}`;
    if (this.targets.has(id)) return id;
    this.targets.set(id, {
      id,
      host,
      port,
      samples: [],
      lossRatio: 0,
      avgLatencyMs: null,
      reconnects: 0,
    });
    deviceManager.upsert({
      id,
      name: `${host}:${port}`,
      connectionType: "ethernet",
      address: `${host}:${port}`,
      status: "Connecting",
      lastSeenAt: new Date().toISOString(),
      capabilities: ["network-monitor"],
    });
    const timer = setInterval(() => void this.tick(id), intervalMs);
    this.timers.set(id, timer);
    void this.tick(id);
    this.emit();
    return id;
  }

  remove(id: string): void {
    const t = this.timers.get(id);
    if (t) clearInterval(t);
    this.timers.delete(id);
    this.targets.delete(id);
    deviceManager.remove(id);
    this.emit();
  }

  private async tick(id: string): Promise<void> {
    const target = this.targets.get(id);
    if (!target) return;
    const prevOk =
      target.samples[0]?.ok === true || target.samples.length === 0;
    try {
      const result = await probeHost(target.host, target.port);
      const sample: NetworkSample = {
        at: new Date().toISOString(),
        ok: result.ok,
        latencyMs: result.latencyMs ?? null,
        error: result.error,
      };
      const samples = [sample, ...target.samples].slice(0, 60);
      const window = samples.slice(0, 20);
      const lost = window.filter((s) => !s.ok).length;
      const okLat = window
        .filter((s) => s.ok && s.latencyMs != null)
        .map((s) => s.latencyMs!);
      let reconnects = target.reconnects;
      if (!prevOk && sample.ok) {
        reconnects += 1;
        eventBus.emit("info", "network-monitor", `Reconnect ${target.host}`);
      }
      const next: MonitoredTarget = {
        ...target,
        samples,
        lossRatio: window.length ? lost / window.length : 0,
        avgLatencyMs: okLat.length
          ? okLat.reduce((a, b) => a + b, 0) / okLat.length
          : null,
        reconnects,
      };
      this.targets.set(id, next);
      deviceManager.setStatus(
        id,
        sample.ok ? "Online" : "Lost",
        sample.ok ? undefined : sample.error,
      );
      this.emit();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      deviceManager.setStatus(id, "Error", msg);
    }
  }
}

export const networkMonitor = new NetworkMonitor();
