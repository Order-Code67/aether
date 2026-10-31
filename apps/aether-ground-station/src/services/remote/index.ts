import type { RemoteTestMode } from "@/types/remote";
import type { RemoteGateway } from "./types";
import { createSandboxRemoteGateway } from "./sandboxGateway";

export type * from "./types";
export { createSandboxRemoteGateway } from "./sandboxGateway";

let mode: RemoteTestMode = "disabled";
let gateway: RemoteGateway | null = null;

export function getRemoteTestMode(): RemoteTestMode {
  return mode;
}

export function setRemoteTestMode(next: RemoteTestMode): void {
  mode = next;
  gateway = next === "sandbox" ? createSandboxRemoteGateway() : null;
}

/** Active gateway or null when remote is disabled / not yet integrated. */
export function getRemoteGateway(): RemoteGateway | null {
  if (mode === "sandbox") {
    gateway ??= createSandboxRemoteGateway();
    return gateway;
  }
  return gateway;
}
