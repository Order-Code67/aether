export type ExtensionCategory =
  | "snippets"
  | "boards"
  | "languages"
  | "themes"
  | "other";

export interface ExtensionSnippet {
  label: string;
  /** Insert as snippet (Monaco snippet syntax: $1, ${1:name}) */
  insertText: string;
  detail?: string;
  documentation?: string;
}

export interface ExtensionBoardPreset {
  id: string;
  label: string;
}

export interface ExtensionManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  publisher: string;
  category: ExtensionCategory;
  /** Bundled with the app vs loaded from disk */
  source: "builtin" | "local";
  /** Absolute path for local extensions */
  path?: string;
  contributes?: {
    languages?: string[];
    snippets?: ExtensionSnippet[];
    boards?: ExtensionBoardPreset[];
  };
}

export interface ExtensionState {
  manifest: ExtensionManifest;
  enabled: boolean;
}
