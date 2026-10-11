/// <reference types="vite/client" />

import type { AetherApi } from "./types/bridge";

declare global {
  interface Window {
    aether?: AetherApi;
  }
}

export {};
