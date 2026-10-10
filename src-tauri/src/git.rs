use std::path::{Path, PathBuf};
use std::process::Command;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitInfo {
    pub installed: bool,
    pub version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitFileEntry {
    pub path: String,
    pub status: String,
    /// staged | unstaged | untracked
    pub group: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitStatus {
    pub is_repo: bool,
    pub root: Option<String>,
    pub branch: Option<String>,
    pub upstream: Option<String>,
    pub ahead: u32,
    pub behind: u32,
    pub staged: Vec<GitFileEntry>,
    pub unstaged: Vec<GitFileEntry>,
    pub untracked: Vec<GitFileEntry>,
    pub unmerged: Vec<GitFileEntry>,
}

fn resolve_git() -> Option<String> {
    which::which("git")
        .ok()
        .map(|p| p.to_string_lossy().to_string())
}

fn run_git(cwd: &Path, args: &[&str]) -> Result<(i32, String, String), String> {
    let git = resolve_git().ok_or_else(|| "Git not found on PATH.".to_string())?;
    let output = Command::new(&git)
        .args(args)
        .current_dir(cwd)
        .output()
        .map_err(|e| format!("Failed to run git: {e}"))?;

    let code = output.status.code().unwrap_or(-1);
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    Ok((code, stdout, stderr))
}

fn find_repo_root(cwd: &Path) -> Option<PathBuf> {
    let (code, stdout, _) = run_git(cwd, &["rev-parse", "--show-toplevel"]).ok()?;
    if code != 0 {
        return None;
    }
    let root = stdout.trim();
    if root.is_empty() {
        None
    } else {
        Some(PathBuf::from(root))
    }
}

fn status_label(xy: &str) -> String {
    match xy {
        "??" => "U".into(),
        "A " | "A?" => "A".into(),
        "M " | "MM" | " M" => "M".into(),
        "D " | " D" => "D".into(),
        "R " | "RM" => "R".into(),
        "C " => "C".into(),
        "UU" | "AA" | "DD" => "!".into(),
        other => other.trim().chars().next().unwrap_or('?').to_string(),
    }
}

fn parse_branch_header(line: &str) -> (Option<String>, Option<String>, u32, u32) {
    // ## main...origin/main [ahead 1, behind 2]
    let rest = line.trim_start_matches("## ").trim();
    let mut branch = None;
    let mut upstream = None;
    let mut ahead = 0u32;
    let mut behind = 0u32;

    let (head, trail) = match rest.split_once('[') {
        Some((h, t)) => (h.trim(), Some(t.trim_end_matches(']'))),
        None => (rest, None),
    };

    if let Some((local, remote)) = head.split_once("...") {
        branch = Some(local.trim().to_string());
        upstream = Some(remote.trim().to_string());
    } else if !head.is_empty() && head != "HEAD (no branch)" {
        branch = Some(head.to_string());
    } else if head.contains("no branch") {
        branch = Some("DETACHED".into());
    }

    if let Some(meta) = trail {
        for part in meta.split(',') {
            let p = part.trim();
            if let Some(n) = p.strip_prefix("ahead ") {
                ahead = n.trim().parse().unwrap_or(0);
            } else if let Some(n) = p.strip_prefix("behind ") {
                behind = n.trim().parse().unwrap_or(0);
            }
        }
    }

    (branch, upstream, ahead, behind)
}

fn is_unmerged(xy: &str) -> bool {
    matches!(
        xy,
        "DD" | "AU" | "UD" | "UA" | "DU" | "AA" | "UU" | "DV" | "VD"
    ) || (xy.len() == 2 && (xy.contains('U') || xy == "AA" || xy == "DD"))
}

fn parse_status_porcelain(stdout: &str) -> GitStatus {
    let mut branch = None;
    let mut upstream = None;
    let mut ahead = 0;
    let mut behind = 0;
    let mut staged = Vec::new();
    let mut unstaged = Vec::new();
    let mut untracked = Vec::new();
    let mut unmerged = Vec::new();

    for line in stdout.lines() {
        if line.starts_with("## ") {
            let (b, u, a, be) = parse_branch_header(line);
            branch = b;
            upstream = u;
            ahead = a;
            behind = be;
            continue;
        }
        if line.len() < 3 {
            continue;
        }
        let x = line.as_bytes()[0] as char;
        let y = line.as_bytes()[1] as char;
        let path_part = &line[3..];
        // rename: "old -> new"
        let path = if let Some((_, new)) = path_part.split_once(" -> ") {
            new.trim().to_string()
        } else {
            path_part.trim().to_string()
        };
        if path.is_empty() {
            continue;
        }

        let xy = format!("{x}{y}");

        if xy == "??" {
            untracked.push(GitFileEntry {
                path,
                status: "U".into(),
                group: "untracked".into(),
            });
            continue;
        }

        if is_unmerged(&xy) {
            unmerged.push(GitFileEntry {
                path,
                status: "!".into(),
                group: "unmerged".into(),
            });
            continue;
        }

        if x != ' ' && x != '?' {
            staged.push(GitFileEntry {
                path: path.clone(),
                status: status_label(&format!("{x} ")),
                group: "staged".into(),
            });
        }
        if y != ' ' && y != '?' {
            unstaged.push(GitFileEntry {
                path,
                status: status_label(&format!(" {y}")),
                group: "unstaged".into(),
            });
        }
    }

    GitStatus {
        is_repo: true,
        root: None,
        branch,
        upstream,
        ahead,
        behind,
        staged,
        unstaged,
        untracked,
        unmerged,
    }
}

#[tauri::command]
pub fn git_detect() -> GitInfo {
    let Some(cmd) = resolve_git() else {
        return GitInfo {
            installed: false,
            version: None,
        };
    };
    let version = Command::new(&cmd)
        .arg("--version")
        .output()
        .ok()
        .and_then(|o| {
            let t = String::from_utf8_lossy(&o.stdout).trim().to_string();
            if t.is_empty() {
                None
            } else {
                Some(t)
            }
        });
    GitInfo {
        installed: true,
        version,
    }
}

#[tauri::command]
pub fn git_status(cwd: String) -> Result<GitStatus, String> {
    if resolve_git().is_none() {
        return Err("Git not found on PATH.".into());
    }
    let cwd_path = PathBuf::from(&cwd);
    if !cwd_path.is_dir() {
        return Err(format!("Not a directory: {cwd}"));
    }

    let Some(root) = find_repo_root(&cwd_path) else {
        return Ok(GitStatus {
            is_repo: false,
            root: None,
            branch: None,
            upstream: None,
            ahead: 0,
            behind: 0,
            staged: Vec::new(),
            unstaged: Vec::new(),
            untracked: Vec::new(),
            unmerged: Vec::new(),
        });
    };

    let (code, stdout, stderr) =
        run_git(&root, &["status", "--porcelain=v1", "-b", "--untracked-files=normal"])?;
    if code != 0 {
        return Err(if stderr.trim().is_empty() {
            format!("git status failed (exit {code})")
        } else {
            stderr.trim().to_string()
        });
    }

    let mut status = parse_status_porcelain(&stdout);
    status.root = Some(root.to_string_lossy().to_string());
    Ok(status)
}

#[tauri::command]
pub fn git_stage(cwd: String, paths: Vec<String>) -> Result<(), String> {
    if paths.is_empty() {
        return Err("No paths to stage.".into());
    }
    let root = find_repo_root(Path::new(&cwd)).ok_or("Not a git repository.")?;
    let mut args = vec!["add".to_string(), "--".to_string()];
    args.extend(paths);
    let arg_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    let (code, _, stderr) = run_git(&root, &arg_refs)?;
    if code != 0 {
        return Err(stderr.trim().to_string());
    }
    Ok(())
}

#[tauri::command]
pub fn git_unstage(cwd: String, paths: Vec<String>) -> Result<(), String> {
    if paths.is_empty() {
        return Err("No paths to unstage.".into());
    }
    let root = find_repo_root(Path::new(&cwd)).ok_or("Not a git repository.")?;

    let mut restore = vec![
        "restore".to_string(),
        "--staged".to_string(),
        "--".to_string(),
    ];
    restore.extend(paths.clone());
    let restore_refs: Vec<&str> = restore.iter().map(|s| s.as_str()).collect();
    let (code, _, stderr) = run_git(&root, &restore_refs)?;
    if code == 0 {
        return Ok(());
    }

    let mut reset = vec!["reset".to_string(), "HEAD".to_string(), "--".to_string()];
    reset.extend(paths);
    let reset_refs: Vec<&str> = reset.iter().map(|s| s.as_str()).collect();
    let (c2, _, e2) = run_git(&root, &reset_refs)?;
    if c2 != 0 {
        return Err(if e2.trim().is_empty() {
            stderr.trim().to_string()
        } else {
            e2.trim().to_string()
        });
    }
    Ok(())
}

#[tauri::command]
pub fn git_discard(cwd: String, paths: Vec<String>) -> Result<(), String> {
    if paths.is_empty() {
        return Err("No paths to discard.".into());
    }
    let root = find_repo_root(Path::new(&cwd)).ok_or("Not a git repository.")?;
    let mut args = vec!["restore".to_string(), "--worktree".to_string(), "--".to_string()];
    args.extend(paths.clone());
    let arg_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    let (code, _, stderr) = run_git(&root, &arg_refs)?;
    if code != 0 {
        let mut legacy = vec!["checkout".to_string(), "--".to_string()];
        legacy.extend(paths);
        let refs: Vec<&str> = legacy.iter().map(|s| s.as_str()).collect();
        let (c2, _, e2) = run_git(&root, &refs)?;
        if c2 != 0 {
            return Err(if e2.trim().is_empty() {
                stderr.trim().to_string()
            } else {
                e2.trim().to_string()
            });
        }
    }
    Ok(())
}

#[tauri::command]
pub fn git_commit(cwd: String, message: String) -> Result<(), String> {
    let msg = message.trim();
    if msg.is_empty() {
        return Err("Commit message is empty.".into());
    }
    let root = find_repo_root(Path::new(&cwd)).ok_or("Not a git repository.")?;
    let (code, _, stderr) = run_git(&root, &["commit", "-m", msg])?;
    if code != 0 {
        return Err(if stderr.trim().is_empty() {
            format!("git commit failed (exit {code})")
        } else {
            stderr.trim().to_string()
        });
    }
    Ok(())
}

#[tauri::command]
pub fn git_diff(cwd: String, path: Option<String>, staged: bool) -> Result<String, String> {
    let root = find_repo_root(Path::new(&cwd)).ok_or("Not a git repository.")?;
    let mut args = vec!["diff".to_string(), "--no-color".to_string()];
    if staged {
        args.push("--cached".into());
    }
    if let Some(p) = path.filter(|s| !s.is_empty()) {
        args.push("--".into());
        args.push(p);
    }
    let arg_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    let (code, stdout, stderr) = run_git(&root, &arg_refs)?;
    if code != 0 && code != 1 {
        // git diff returns 1 when differences exist with --exit-code; without it, 0
        return Err(stderr.trim().to_string());
    }
    Ok(stdout)
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitBranch {
    pub name: String,
    pub current: bool,
    pub remote: bool,
    pub upstream: Option<String>,
}

fn git_err(code: i32, stdout: &str, stderr: &str) -> String {
    let msg = if !stderr.trim().is_empty() {
        stderr.trim()
    } else if !stdout.trim().is_empty() {
        stdout.trim()
    } else {
        return format!("git failed (exit {code})");
    };
    msg.to_string()
}

#[tauri::command]
pub fn git_branches(cwd: String) -> Result<Vec<GitBranch>, String> {
    let root = find_repo_root(Path::new(&cwd)).ok_or("Not a git repository.")?;
    let (code, stdout, stderr) = run_git(
        &root,
        &[
            "for-each-ref",
            "--format=%(refname:short)%00%(HEAD)%00%(upstream:short)%00%(refname)",
            "refs/heads",
            "refs/remotes",
        ],
    )?;
    if code != 0 {
        return Err(git_err(code, &stdout, &stderr));
    }

    let mut branches = Vec::new();
    for line in stdout.lines() {
        if line.is_empty() {
            continue;
        }
        let parts: Vec<&str> = line.split('\0').collect();
        if parts.len() < 4 {
            continue;
        }
        let name = parts[0].trim().to_string();
        if name.is_empty() || name == "origin/HEAD" || name.ends_with("/HEAD") {
            continue;
        }
        let current = parts[1].trim() == "*";
        let upstream = {
            let u = parts[2].trim();
            if u.is_empty() {
                None
            } else {
                Some(u.to_string())
            }
        };
        let remote = parts[3].starts_with("refs/remotes/");
        branches.push(GitBranch {
            name,
            current,
            remote,
            upstream,
        });
    }

    branches.sort_by(|a, b| {
        b.current
            .cmp(&a.current)
            .then(a.remote.cmp(&b.remote))
            .then(a.name.cmp(&b.name))
    });
    Ok(branches)
}

#[tauri::command]
pub fn git_checkout(cwd: String, branch: String) -> Result<(), String> {
    let name = branch.trim();
    if name.is_empty() {
        return Err("Branch name is empty.".into());
    }
    let root = find_repo_root(Path::new(&cwd)).ok_or("Not a git repository.")?;

    // Remote-tracking ref: create/reset local branch tracking it
    if let Some(slash) = name.find('/') {
        if slash > 0 && !name.starts_with("refs/") {
            let local = name.rsplit('/').next().unwrap_or(name);
            let (code, _, _) = run_git(&root, &["checkout", "-B", local, "--track", name])?;
            if code == 0 {
                return Ok(());
            }
            let (c2, o2, e2) = run_git(&root, &["checkout", local])?;
            if c2 == 0 {
                return Ok(());
            }
            return Err(git_err(c2, &o2, &e2));
        }
    }

    let (code, stdout, stderr) = run_git(&root, &["checkout", name])?;
    if code != 0 {
        return Err(git_err(code, &stdout, &stderr));
    }
    Ok(())
}

#[tauri::command]
pub fn git_create_branch(cwd: String, name: String, checkout: bool) -> Result<(), String> {
    let branch = name.trim();
    if branch.is_empty() {
        return Err("Branch name is empty.".into());
    }
    let root = find_repo_root(Path::new(&cwd)).ok_or("Not a git repository.")?;
    if checkout {
        let (code, stdout, stderr) = run_git(&root, &["checkout", "-b", branch])?;
        if code != 0 {
            return Err(git_err(code, &stdout, &stderr));
        }
    } else {
        let (code, stdout, stderr) = run_git(&root, &["branch", branch])?;
        if code != 0 {
            return Err(git_err(code, &stdout, &stderr));
        }
    }
    Ok(())
}

#[tauri::command]
pub fn git_fetch(cwd: String) -> Result<String, String> {
    let root = find_repo_root(Path::new(&cwd)).ok_or("Not a git repository.")?;
    let (code, stdout, stderr) = run_git(&root, &["fetch", "--all", "--prune"])?;
    if code != 0 {
        return Err(git_err(code, &stdout, &stderr));
    }
    let msg = if stderr.trim().is_empty() {
        if stdout.trim().is_empty() {
            "Fetch complete.".to_string()
        } else {
            stdout.trim().to_string()
        }
    } else {
        stderr.trim().to_string()
    };
    Ok(msg)
}

#[tauri::command]
pub fn git_pull(cwd: String) -> Result<String, String> {
    let root = find_repo_root(Path::new(&cwd)).ok_or("Not a git repository.")?;
    let (code, stdout, stderr) = run_git(&root, &["pull", "--ff-only"])?;
    if code != 0 {
        // Retry without ff-only for broader compatibility (still non-destructive merge default)
        let (c2, o2, e2) = run_git(&root, &["pull"])?;
        if c2 != 0 {
            return Err(git_err(c2, &o2, &e2));
        }
        return Ok(if o2.trim().is_empty() {
            e2.trim().to_string()
        } else {
            o2.trim().to_string()
        });
    }
    Ok(if stdout.trim().is_empty() {
        if stderr.trim().is_empty() {
            "Already up to date.".into()
        } else {
            stderr.trim().to_string()
        }
    } else {
        stdout.trim().to_string()
    })
}

#[tauri::command]
pub fn git_push(cwd: String, set_upstream: bool) -> Result<String, String> {
    let root = find_repo_root(Path::new(&cwd)).ok_or("Not a git repository.")?;
    let args: Vec<&str> = if set_upstream {
        vec!["push", "-u", "origin", "HEAD"]
    } else {
        vec!["push"]
    };
    let (code, stdout, stderr) = run_git(&root, &args)?;
    if code != 0 {
        // No upstream yet — try set-upstream once
        if !set_upstream {
            let (c2, o2, e2) = run_git(&root, &["push", "-u", "origin", "HEAD"])?;
            if c2 != 0 {
                return Err(git_err(c2, &o2, &e2));
            }
            return Ok(if e2.trim().is_empty() {
                o2.trim().to_string()
            } else {
                e2.trim().to_string()
            });
        }
        return Err(git_err(code, &stdout, &stderr));
    }
    Ok(if stderr.trim().is_empty() {
        if stdout.trim().is_empty() {
            "Push complete.".into()
        } else {
            stdout.trim().to_string()
        }
    } else {
        stderr.trim().to_string()
    })
}
