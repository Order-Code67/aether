import type { RemoteTestMode } from "@/types/remote";
import type { RemoteGateway } from "./types";
import { createSandboxRemoteGateway } from "./sandboxGateway";
import { createLocalGatewayStub } from "./localGatewayStub";

export type * from "./types";
export { createSandboxRemoteGateway } from "./sandboxGateway";
export { createLocalGatewayStub } from "./localGatewayStub";

let mode: RemoteTestMode = "disabled";
let gateway: RemoteGateway | null = null;

export function getRemoteTestMode(): RemoteTestMode {
  return mode;
}

export function setRemoteTestMode(next: RemoteTestMode): void {
  mode = next;
  if (next === "sandbox") {
    gateway = createSandboxRemoteGateway();
  } else if (next === "integration") {
    gateway = createLocalGatewayStub();
  } else {
    gateway = null;
  }
}

/** Active gateway or null when remote is disabled. */
export function getRemoteGateway(): RemoteGateway | null {
  if (mode === "sandbox") {
    gateway ??= createSandboxRemoteGateway();
    return gateway;
  }
  if (mode === "integration") {
    gateway ??= createLocalGatewayStub();
    return gateway;
  }
  return null;
}
