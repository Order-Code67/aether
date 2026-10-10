import { create } from "zustand";
import { persist } from "zustand/middleware";
import { basename } from "@/lib/paths";
import { searchWorkspace, type SearchHit } from "@/lib/search";
import { isTauriRuntime } from "@/lib/tauri";
import { useEditorStore } from "@/stores/editorStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

interface SearchState {
  query: string;
  caseSensitive: boolean;
  includeExtensions: string;
  hits: SearchHit[];
  truncated: boolean;
  filesScanned: number;
  busy: boolean;
  error: string | null;
  setQuery: (q: string) => void;
  setCaseSensitive: (v: boolean) => void;
  setIncludeExtensions: (v: string) => void;
  clear: () => void;
  run: () => Promise<void>;
  openHit: (hit: SearchHit) => Promise<void>;
}

export const useSearchStore = create<SearchState>()(
  persist(
    (set, get) => ({
      query: "",
      caseSensitive: false,
      includeExtensions: "",
      hits: [],
      truncated: false,
      filesScanned: 0,
      busy: false,
      error: null,

      setQuery: (q) => set({ query: q }),
      setCaseSensitive: (v) => set({ caseSensitive: v }),
      setIncludeExtensions: (v) => set({ includeExtensions: v }),

      clear: () =>
        set({
          hits: [],
          truncated: false,
          filesScanned: 0,
          error: null,
        }),

      run: async () => {
        const query = get().query.trim();
        if (!query) {
          set({ hits: [], truncated: false, filesScanned: 0, error: null });
          return;
        }

        if (!isTauriRuntime()) {
          set({
            error: "Search requires the desktop app (npm run tauri:dev).",
          });
          return;
        }

        const { kind, folders } = useWorkspaceStore.getState();
        if (kind !== "folder" || folders.length === 0) {
          set({ error: "Open a folder to search the workspace." });
          return;
        }

        set({ busy: true, error: null });
        try {
          const result = await searchWorkspace({
            roots: folders.map((f) => f.path),
            query,
            caseSensitive: get().caseSensitive,
            includeExtensions: get().includeExtensions || undefined,
          });
          set({
            busy: false,
            hits: result.hits,
            truncated: result.truncated,
            filesScanned: result.filesScanned,
            error: null,
          });
        } catch (error) {
          set({
            busy: false,
            error:
              error instanceof Error ? error.message : "Search failed.",
          });
        }
      },

      openHit: async (hit) => {
        await useWorkspaceStore.getState().openPathInEditor(hit.path);
        useEditorStore.getState().requestReveal({
          path: hit.path,
          lineNumber: hit.line,
          column: hit.column,
        });
      },
    }),
    {
      name: "aether-search",
      partialize: (state) => ({
        caseSensitive: state.caseSensitive,
        includeExtensions: state.includeExtensions,
      }),
    },
  ),
);

export function groupHitsByFile(hits: SearchHit[]): {
  path: string;
  name: string;
  hits: SearchHit[];
}[] {
  const map = new Map<string, SearchHit[]>();
  for (const hit of hits) {
    const list = map.get(hit.path) ?? [];
    list.push(hit);
    map.set(hit.path, list);
  }
  return [...map.entries()].map(([path, fileHits]) => ({
    path,
    name: basename(path),
    hits: fileHits,
  }));
}
