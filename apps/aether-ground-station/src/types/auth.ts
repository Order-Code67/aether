export type UserRole = "Administrator" | "Operator" | "Observer";

export interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
  disabled: boolean;
}

export interface AuthSession {
  user: AuthUser;
  loggedInAt: string;
}

export const ROLE_PERMISSIONS: Record<
  UserRole,
  {
    manageUsers: boolean;
    manageDevices: boolean;
    managePlugins: boolean;
    editConfig: boolean;
    viewVideo: boolean;
    viewTelemetry: boolean;
    viewMap: boolean;
    viewEvents: boolean;
  }
> = {
  Administrator: {
    manageUsers: true,
    manageDevices: true,
    managePlugins: true,
    editConfig: true,
    viewVideo: true,
    viewTelemetry: true,
    viewMap: true,
    viewEvents: true,
  },
  Operator: {
    manageUsers: false,
    manageDevices: true,
    managePlugins: false,
    editConfig: false,
    viewVideo: true,
    viewTelemetry: true,
    viewMap: true,
    viewEvents: true,
  },
  Observer: {
    manageUsers: false,
    manageDevices: false,
    managePlugins: false,
    editConfig: false,
    viewVideo: true,
    viewTelemetry: true,
    viewMap: true,
    viewEvents: true,
  },
};
