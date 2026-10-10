import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  BUILTIN_EXTENSIONS,
  DEFAULT_ENABLED_EXTENSIONS,
} from "@/extensions/builtin";
import {
  collectBoards,
  collectSnippets,
  loadExtensionFromUrl,
  pickAndLoadExtension,
} from "@/lib/extensionLoader";
import {
  buildCatalogEntry,
  buildHubCatalog,
  contentHash,
  exportExtensionPackage,
  exportHubCatalogFile,
  type PublishDraft,
  validateDraft,
} from "@/lib/extensionPublisher";
import {
  fetchCatalog,
  installCatalogEntry,
  type CatalogEntry,
  type ExtensionCatalog,
} from "@/lib/marketplace";
import type {
  ExtensionBoardPreset,
  ExtensionManifest,
  ExtensionSnippet,
} from "@/types/extensions";

function mergeLocal(manifest: ExtensionManifest) {
  return (state: {
    localExtensions: ExtensionManifest[];
    enabledIds: string[];
  }) => {
    const without = state.localExtensions.filter((e) => e.id !== manifest.id);
    const enabledIds = state.enabledIds.includes(manifest.id)
      ? state.enabledIds
      : [...state.enabledIds, manifest.id];
    return {
      localExtensions: [...without, manifest],
      enabledIds,
      error: null as string | null,
    };
  };
}

interface ExtensionStoreState {
  enabledIds: string[];
  localExtensions: ExtensionManifest[];
  /** Local publishing hub catalog entries (merged into Marketplace). */
  hubEntries: CatalogEntry[];
  catalogUrl: string;
  catalog: ExtensionCatalog | null;
  catalogLoading: boolean;
  error: string | null;
  publishMessage: string | null;
  /** Requested Extensions panel tab (e.g. from Command Palette). */
  preferredPanelTab: "installed" | "marketplace" | "publish" | null;
  setPreferredPanelTab: (
    tab: "installed" | "marketplace" | "publish" | null,
  ) => void;
  allManifests: () => ExtensionManifest[];
  enabledManifests: () => ExtensionManifest[];
  isEnabled: (id: string) => boolean;
  isInstalled: (id: string) => boolean;
  setEnabled: (id: string, enabled: boolean) => void;
  toggle: (id: string) => void;
  setCatalogUrl: (url: string) => void;
  refreshCatalog: () => Promise<void>;
  installFromFolder: () => Promise<boolean>;
  installFromUrl: (url: string) => Promise<boolean>;
  installFromCatalog: (entry: CatalogEntry) => Promise<boolean>;
  uninstallLocal: (id: string) => void;
  publishToHub: (draft: PublishDraft) => Promise<boolean>;
  unpublishFromHub: (id: string) => void;
  exportPackage: (draft: PublishDraft) => Promise<string | null>;
  exportHubCatalog: () => Promise<string | null>;
  snippetsForLanguage: (language: string) => ExtensionSnippet[];
  boardPresets: () => ExtensionBoardPreset[];
}

export const useExtensionStore = create<ExtensionStoreState>()(
  persist(
    (set, get) => ({
      enabledIds: DEFAULT_ENABLED_EXTENSIONS,
      localExtensions: [],
      hubEntries: [],
      catalogUrl: "",
      catalog: null,
      catalogLoading: false,
      error: null,
      publishMessage: null,
      preferredPanelTab: null,

      setPreferredPanelTab: (tab) => set({ preferredPanelTab: tab }),

      allManifests: () => {
        const locals = get().localExtensions;
        const localIds = new Set(locals.map((l) => l.id));
        return [
          ...BUILTIN_EXTENSIONS.filter((b) => !localIds.has(b.id)),
          ...locals,
        ];
      },

      enabledManifests: () => {
        const enabled = new Set(get().enabledIds);
        return get()
          .allManifests()
          .filter((m) => enabled.has(m.id));
      },

      isEnabled: (id) => get().enabledIds.includes(id),

      isInstalled: (id) =>
        get().localExtensions.some((e) => e.id === id) ||
        BUILTIN_EXTENSIONS.some((e) => e.id === id),

      setEnabled: (id, enabled) => {
        set((state) => {
          const has = state.enabledIds.includes(id);
          if (enabled && !has) {
            return { enabledIds: [...state.enabledIds, id], error: null };
          }
          if (!enabled && has) {
            return {
              enabledIds: state.enabledIds.filter((x) => x !== id),
              error: null,
            };
          }
          return state;
        });
      },

      toggle: (id) => {
        get().setEnabled(id, !get().isEnabled(id));
      },

      setCatalogUrl: (url) => set({ catalogUrl: url }),

      refreshCatalog: async () => {
        set({ catalogLoading: true, error: null });
        try {
          const catalog = await fetchCatalog(
            get().catalogUrl || null,
            get().hubEntries,
          );
          set({ catalog, catalogLoading: false });
        } catch (error) {
          set({
            catalogLoading: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to load catalog.",
          });
        }
      },

      installFromFolder: async () => {
        try {
          const manifest = await pickAndLoadExtension();
          if (!manifest) return false;
          set(mergeLocal(manifest));
          return true;
        } catch (error) {
          set({
            error:
              error instanceof Error
                ? error.message
                : "Failed to load extension.",
          });
          return false;
        }
      },

      installFromUrl: async (url) => {
        try {
          const manifest = await loadExtensionFromUrl(url);
          set(mergeLocal(manifest));
          return true;
        } catch (error) {
          set({
            error:
              error instanceof Error
                ? error.message
                : "Failed to install from URL.",
          });
          return false;
        }
      },

      installFromCatalog: async (entry) => {
        try {
          const manifest = await installCatalogEntry(entry);
          set(mergeLocal(manifest));
          return true;
        } catch (error) {
          set({
            error:
              error instanceof Error
                ? error.message
                : "Failed to install from catalog.",
          });
          return false;
        }
      },

      uninstallLocal: (id) => {
        set((state) => ({
          localExtensions: state.localExtensions.filter((e) => e.id !== id),
          enabledIds: state.enabledIds.filter((x) => x !== id),
          error: null,
        }));
      },

      publishToHub: async (draft) => {
        const result = validateDraft(draft);
        if (!result.ok || !result.manifest) {
          set({
            error: result.errors.join(" "),
            publishMessage: null,
          });
          return false;
        }
        try {
          const hash = await contentHash(result.manifest);
          const entry = buildCatalogEntry(
            result.manifest,
            draft.downloadUrl,
            hash,
          );
          set((state) => {
            const without = state.hubEntries.filter((e) => e.id !== entry.id);
            return {
              hubEntries: [...without, entry],
              error: null,
              publishMessage: `Published ${entry.id}@${result.manifest!.version} to local hub.`,
            };
          });
          // Also install locally so author can use it immediately
          set(mergeLocal(result.manifest));
          void get().refreshCatalog();
          return true;
        } catch (error) {
          set({
            error:
              error instanceof Error
                ? error.message
                : "Failed to publish to hub.",
            publishMessage: null,
          });
          return false;
        }
      },

      unpublishFromHub: (id) => {
        set((state) => ({
          hubEntries: state.hubEntries.filter((e) => e.id !== id),
          publishMessage: `Removed ${id} from local hub.`,
          error: null,
        }));
        void get().refreshCatalog();
      },

      exportPackage: async (draft) => {
        const result = validateDraft(draft);
        if (!result.ok || !result.manifest) {
          set({ error: result.errors.join(" "), publishMessage: null });
          return null;
        }
        try {
          const dir = await exportExtensionPackage(result.manifest);
          if (dir) {
            set({
              publishMessage: `Exported package to ${dir}`,
              error: null,
            });
          }
          return dir;
        } catch (error) {
          set({
            error:
              error instanceof Error
                ? error.message
                : "Failed to export package.",
            publishMessage: null,
          });
          return null;
        }
      },

      exportHubCatalog: async () => {
        try {
          const catalog = buildHubCatalog(get().hubEntries);
          const path = await exportHubCatalogFile(catalog);
          if (path) {
            set({
              publishMessage: `Exported hub catalog to ${path}`,
              error: null,
            });
          }
          return path;
        } catch (error) {
          set({
            error:
              error instanceof Error
                ? error.message
                : "Failed to export hub catalog.",
            publishMessage: null,
          });
          return null;
        }
      },

      snippetsForLanguage: (language) =>
        collectSnippets(get().enabledManifests(), language),

      boardPresets: () => collectBoards(get().enabledManifests()),
    }),
    {
      name: "aether-extensions",
      partialize: (state) => ({
        enabledIds: state.enabledIds,
        localExtensions: state.localExtensions,
        catalogUrl: state.catalogUrl,
        hubEntries: state.hubEntries,
      }),
    },
  ),
);
