/** External official iNav Configurator is optional; БПЛА-Студия is the primary app. */

export const INAV_CONFIGURATOR_DOWNLOAD_URL =
  "https://github.com/iNavFlight/inav-configurator/releases";
export const INAV_DOCS_URL = "https://github.com/iNavFlight/inav/wiki";

export type InavConfiguratorInfo = {
  installed: boolean;
  path: string | null;
};

export async function detectInavConfigurator(): Promise<InavConfiguratorInfo> {
  return { installed: false, path: null };
}

export async function openInavConfigurator(): Promise<void> {
  throw new Error("Use БПЛА-Студия itself — external Configurator is optional.");
}
