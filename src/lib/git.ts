import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "@/lib/tauri";

export interface GitInfo {
  installed: boolean;
  version: string | null;
}

export interface GitFileEntry {
  path: string;
  status: string;
  group: "staged" | "unstaged" | "untracked" | string;
}

export interface GitStatus {
  isRepo: boolean;
  root: string | null;
  branch: string | null;
  upstream: string | null;
  ahead: number;
  behind: number;
  staged: GitFileEntry[];
  unstaged: GitFileEntry[];
  untracked: GitFileEntry[];
  unmerged: GitFileEntry[];
}

export interface GitBranch {
  name: string;
  current: boolean;
  remote: boolean;
  upstream: string | null;
}

export async function gitDetect(): Promise<GitInfo> {
  if (!isTauriRuntime()) {
    return { installed: false, version: null };
  }
  return invoke<GitInfo>("git_detect");
}

export async function gitStatus(cwd: string): Promise<GitStatus> {
  return invoke<GitStatus>("git_status", { cwd });
}

export async function gitStage(cwd: string, paths: string[]): Promise<void> {
  await invoke("git_stage", { cwd, paths });
}

export async function gitUnstage(cwd: string, paths: string[]): Promise<void> {
  await invoke("git_unstage", { cwd, paths });
}

export async function gitDiscard(cwd: string, paths: string[]): Promise<void> {
  await invoke("git_discard", { cwd, paths });
}

export async function gitCommit(cwd: string, message: string): Promise<void> {
  await invoke("git_commit", { cwd, message });
}

export async function gitDiff(
  cwd: string,
  options?: { path?: string; staged?: boolean },
): Promise<string> {
  return invoke<string>("git_diff", {
    cwd,
    path: options?.path ?? null,
    staged: options?.staged ?? false,
  });
}

export async function gitBranches(cwd: string): Promise<GitBranch[]> {
  return invoke<GitBranch[]>("git_branches", { cwd });
}

export async function gitCheckout(cwd: string, branch: string): Promise<void> {
  await invoke("git_checkout", { cwd, branch });
}

export async function gitCreateBranch(
  cwd: string,
  name: string,
  checkout = true,
): Promise<void> {
  await invoke("git_create_branch", { cwd, name, checkout });
}

export async function gitFetch(cwd: string): Promise<string> {
  return invoke<string>("git_fetch", { cwd });
}

export async function gitPull(cwd: string): Promise<string> {
  return invoke<string>("git_pull", { cwd });
}

export async function gitPush(
  cwd: string,
  setUpstream = false,
): Promise<string> {
  return invoke<string>("git_push", { cwd, setUpstream });
}
