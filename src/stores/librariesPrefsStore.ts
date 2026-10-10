import { create } from "zustand";
import { persist } from "zustand/middleware";

const MAX_RECENT = 12;
const MAX_FAVORITES = 40;

interface LibrariesPrefsState {
  favorites: string[];
  recent: string[];
  toggleFavorite: (spec: string) => void;
  isFavorite: (spec: string) => boolean;
  pushRecent: (spec: string) => void;
  removeFavorite: (spec: string) => void;
}

function normalizeSpec(spec: string): string {
  return spec.trim();
}

export const useLibrariesPrefsStore = create<LibrariesPrefsState>()(
  persist(
    (set, get) => ({
      favorites: [],
      recent: [],

      toggleFavorite: (spec) => {
        const key = normalizeSpec(spec);
        if (!key) return;
        set((state) => {
          const exists = state.favorites.some(
            (f) => f.toLowerCase() === key.toLowerCase(),
          );
          if (exists) {
            return {
              favorites: state.favorites.filter(
                (f) => f.toLowerCase() !== key.toLowerCase(),
              ),
            };
          }
          return {
            favorites: [key, ...state.favorites].slice(0, MAX_FAVORITES),
          };
        });
      },

      isFavorite: (spec) => {
        const key = normalizeSpec(spec).toLowerCase();
        return get().favorites.some((f) => f.toLowerCase() === key);
      },

      pushRecent: (spec) => {
        const key = normalizeSpec(spec);
        if (!key) return;
        set((state) => {
          const rest = state.recent.filter(
            (r) => r.toLowerCase() !== key.toLowerCase(),
          );
          return { recent: [key, ...rest].slice(0, MAX_RECENT) };
        });
      },

      removeFavorite: (spec) => {
        const key = normalizeSpec(spec).toLowerCase();
        set((state) => ({
          favorites: state.favorites.filter((f) => f.toLowerCase() !== key),
        }));
      },
    }),
    {
      name: "aether-libraries-prefs",
      partialize: (state) => ({
        favorites: state.favorites,
        recent: state.recent,
      }),
    },
  ),
);
