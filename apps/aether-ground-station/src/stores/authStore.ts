import { create } from "zustand";
import type { AuthSession, AuthUser, UserRole } from "@/types/auth";
import { ROLE_PERMISSIONS } from "@/types/auth";
import { eventBus } from "@/services/events/eventBus";
import {
  dbGetJson,
  dbListUsers,
  dbUpsertJson,
  dbVerifyUserPassword,
  ensureDefaultAdmin,
} from "@/services/database";

interface AuthState {
  session: AuthSession | null;
  ready: boolean;
  users: AuthUser[];
  bootstrap: () => Promise<void>;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  can: (perm: keyof (typeof ROLE_PERMISSIONS)["Administrator"]) => boolean;
  refreshUsers: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  ready: false,
  users: [],

  bootstrap: async () => {
    await ensureDefaultAdmin();
    const users = await dbListUsers();
    const saved = await dbGetJson<AuthSession | null>("auth_session", null);
    set({
      users,
      session: saved && !saved.user.disabled ? saved : null,
      ready: true,
    });
  },

  login: async (username, password) => {
    const ok = await dbVerifyUserPassword(username, password);
    if (!ok) {
      eventBus.emit("warning", "auth", "Неверный логин или пароль");
      return false;
    }
    const users = await dbListUsers();
    const user = users.find(
      (u) => u.username.toLowerCase() === username.trim().toLowerCase(),
    );
    if (!user || user.disabled) {
      eventBus.emit("warning", "auth", "Учётная запись отключена");
      return false;
    }
    const session: AuthSession = {
      user,
      loggedInAt: new Date().toISOString(),
    };
    await dbUpsertJson("auth_session", session);
    set({ session, users });
    eventBus.emit("info", "auth", `Вход: ${user.username} (${user.role})`);
    return true;
  },

  logout: () => {
    void dbUpsertJson("auth_session", null);
    const name = get().session?.user.username;
    set({ session: null });
    if (name) eventBus.emit("info", "auth", `Выход: ${name}`);
  },

  can: (perm) => {
    const role: UserRole | undefined = get().session?.user.role;
    if (!role) return false;
    return ROLE_PERMISSIONS[role][perm];
  },

  refreshUsers: async () => {
    set({ users: await dbListUsers() });
  },
}));
