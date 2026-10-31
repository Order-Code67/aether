import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { GroundStationProfile, ProfileExportBundle } from "@/types";

interface ProfileState {
  profiles: GroundStationProfile[];
  activeProfileId: string | null;
  create: (name: string) => GroundStationProfile;
  update: (id: string, patch: Partial<GroundStationProfile>) => void;
  remove: (id: string) => void;
  duplicate: (id: string) => void;
  setActive: (id: string | null) => void;
  exportProfile: (id: string) => ProfileExportBundle | null;
  importProfile: (bundle: ProfileExportBundle) => GroundStationProfile | null;
}

function id(): string {
  return `prf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      profiles: [],
      activeProfileId: null,

      create: (name) => {
        const now = new Date().toISOString();
        const profile: GroundStationProfile = {
          id: id(),
          name: name.trim() || "Новый комплекс",
          createdAt: now,
          updatedAt: now,
          deviceIds: [],
          connectionParams: {},
        };
        set((s) => ({
          profiles: [...s.profiles, profile],
          activeProfileId: profile.id,
        }));
        return profile;
      },

      update: (profileId, patch) =>
        set((s) => ({
          profiles: s.profiles.map((p) =>
            p.id === profileId
              ? { ...p, ...patch, id: p.id, updatedAt: new Date().toISOString() }
              : p,
          ),
        })),

      remove: (profileId) =>
        set((s) => ({
          profiles: s.profiles.filter((p) => p.id !== profileId),
          activeProfileId:
            s.activeProfileId === profileId ? null : s.activeProfileId,
        })),

      duplicate: (profileId) => {
        const src = get().profiles.find((p) => p.id === profileId);
        if (!src) return;
        const now = new Date().toISOString();
        const copy: GroundStationProfile = {
          ...structuredClone(src),
          id: id(),
          name: `${src.name} (копия)`,
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({
          profiles: [...s.profiles, copy],
          activeProfileId: copy.id,
        }));
      },

      setActive: (activeProfileId) => set({ activeProfileId }),

      exportProfile: (profileId) => {
        const profile = get().profiles.find((p) => p.id === profileId);
        if (!profile) return null;
        const safe = structuredClone(profile);
        // Secrets must never leave plaintext in exports
        if (safe.connectionParams) {
          for (const key of Object.keys(safe.connectionParams)) {
            if (/pass|secret|token|key/i.test(key)) {
              delete safe.connectionParams[key];
            }
          }
        }
        return {
          format: "aether-gs-profile",
          version: 1,
          exportedAt: new Date().toISOString(),
          profile: safe,
        };
      },

      importProfile: (bundle) => {
        if (bundle.format !== "aether-gs-profile" || bundle.version !== 1) {
          return null;
        }
        const now = new Date().toISOString();
        const profile: GroundStationProfile = {
          ...bundle.profile,
          id: id(),
          createdAt: now,
          updatedAt: now,
          connectionParams: { ...bundle.profile.connectionParams },
        };
        set((s) => ({
          profiles: [...s.profiles, profile],
          activeProfileId: profile.id,
        }));
        return profile;
      },
    }),
    { name: "ags-profiles-v1" },
  ),
);
