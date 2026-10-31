import type { DeviceCard, DeviceStatus } from "@/types";
import { eventBus } from "@/services/events/eventBus";
import { dbUpsertJson } from "@/services/database";

type Listener = (devices: DeviceCard[]) => void;

/**
 * Unified Device Manager — single registry for COM/USB/Network/Capture cards.
 * Modules report status here; UI never invents devices.
 */
class DeviceManager {
  private devices = new Map<string, DeviceCard>();
  private listeners = new Set<Listener>();
  private reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private reconnectHandlers = new Map<string, () => Promise<void>>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.list());
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    const list = this.list();
    for (const l of this.listeners) l(list);
    void dbUpsertJson("devices_snapshot", list);
  }

  list(): DeviceCard[] {
    return [...this.devices.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  get(id: string): DeviceCard | undefined {
    return this.devices.get(id);
  }

  upsert(device: DeviceCard): void {
    const prev = this.devices.get(device.id);
    this.devices.set(device.id, {
      ...prev,
      ...device,
      lastSeenAt: device.lastSeenAt ?? new Date().toISOString(),
    });
    this.emit();
  }

  setStatus(id: string, status: DeviceStatus, error?: string): void {
    const cur = this.devices.get(id);
    if (!cur) return;
    const next: DeviceCard = {
      ...cur,
      status,
      lastSeenAt: new Date().toISOString(),
      capabilities: cur.capabilities,
    };
    if (error) {
      eventBus.emit("warning", "device-manager", `${cur.name}: ${error}`);
    }
    if (status === "Lost" || status === "Offline" || status === "Error") {
      this.scheduleReconnect(id);
    }
    if (status === "Online") {
      this.clearReconnect(id);
    }
    this.devices.set(id, next);
    this.emit();
  }

  remove(id: string): void {
    this.clearReconnect(id);
    this.reconnectHandlers.delete(id);
    this.devices.delete(id);
    this.emit();
  }

  registerReconnectHandler(id: string, handler: () => Promise<void>): void {
    this.reconnectHandlers.set(id, handler);
  }

  private clearReconnect(id: string): void {
    const t = this.reconnectTimers.get(id);
    if (t) clearTimeout(t);
    this.reconnectTimers.delete(id);
  }

  private scheduleReconnect(id: string): void {
    if (this.reconnectTimers.has(id)) return;
    const handler = this.reconnectHandlers.get(id);
    if (!handler) return;
    const timer = setTimeout(() => {
      this.reconnectTimers.delete(id);
      const card = this.devices.get(id);
      if (!card) return;
      if (card.status === "Online") return;
      this.setStatus(id, "Connecting");
      void handler()
        .then(() => this.setStatus(id, "Online"))
        .catch((e) => {
          const msg = e instanceof Error ? e.message : String(e);
          this.setStatus(id, "Lost", msg);
        });
    }, 3000);
    this.reconnectTimers.set(id, timer);
    eventBus.emit("info", "device-manager", `Повторное подключение: ${id}`);
  }

  hydrate(snapshot: DeviceCard[]): void {
    this.devices.clear();
    for (const d of snapshot) this.devices.set(d.id, d);
    this.emit();
  }
}

export const deviceManager = new DeviceManager();
