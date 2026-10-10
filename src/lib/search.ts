import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "@/lib/tauri";

export interface SearchHit {
  path: string;
  line: number;
  column: number;
  preview: string;
}

export interface SearchResponse {
  hits: SearchHit[];
  truncated: boolean;
  filesScanned: number;
}

export async function searchWorkspace(options: {
  roots: string[];
  query: string;
  caseSensitive?: boolean;
  maxResults?: number;
  includeExtensions?: string;
}): Promise<SearchResponse> {
  if (!isTauriRuntime()) {
    throw new Error("Search requires the desktop app (npm run tauri:dev).");
  }
  return invoke<SearchResponse>("search_workspace", {
    request: {
      roots: options.roots,
      query: options.query,
      caseSensitive: options.caseSensitive ?? false,
      maxResults: options.maxResults ?? 500,
      includeExtensions: options.includeExtensions?.trim() || null,
    },
  });
}
