import type { WalksnailDeviceSettings } from "./video";

export interface GroundStationProfile {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  description?: string;
  deviceIds: string[];
  workspaceLayoutId?: string;
  walksnail?: WalksnailDeviceSettings;
  connectionParams: Record<string, unknown>;
}

export interface ProfileExportBundle {
  format: "aether-gs-profile";
  version: 1;
  exportedAt: string;
  profile: GroundStationProfile;
}
