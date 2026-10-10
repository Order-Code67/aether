import { invoke } from "@tauri-apps/api/core";

export interface BundledExample {
  id: string;
  title: string;
  description: string;
  board: string;
}

export function listBundledExamples(): Promise<BundledExample[]> {
  return invoke("list_bundled_examples");
}

export function materializeBundledExample(id: string): Promise<string> {
  return invoke("materialize_bundled_example", { id });
}
