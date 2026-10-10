use std::fs::File;
use std::io::{BufRead, BufReader, Read};
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use walkdir::WalkDir;

const MAX_FILE_BYTES: u64 = 2 * 1024 * 1024;
const DEFAULT_MAX_RESULTS: usize = 500;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchRequest {
    pub roots: Vec<String>,
    pub query: String,
    pub case_sensitive: bool,
    pub max_results: Option<usize>,
    /// Optional include filter, e.g. "cpp,h,ini"
    pub include_extensions: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    pub path: String,
    pub line: usize,
    pub column: usize,
    pub preview: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResponse {
    pub hits: Vec<SearchHit>,
    pub truncated: bool,
    pub files_scanned: usize,
}

fn should_skip_dir(name: &str) -> bool {
    matches!(
        name,
        ".git"
            | ".svn"
            | ".hg"
            | ".pio"
            | ".vscode"
            | ".idea"
            | "node_modules"
            | "dist"
            | "build"
            | "out"
            | "target"
            | "__pycache__"
            | ".cache"
            | "coverage"
    )
}

fn is_probably_binary_ext(path: &Path) -> bool {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    matches!(
        ext.as_str(),
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "ico" | "bmp" | "pdf"
            | "zip" | "7z" | "rar" | "gz" | "tar" | "exe" | "dll" | "so"
            | "dylib" | "bin" | "elf" | "hex" | "o" | "a" | "lib" | "wasm"
            | "mp3" | "mp4" | "wav" | "avi" | "mov" | "woff" | "woff2" | "ttf"
            | "otf" | "class" | "pyc" | "obj" | "pdb"
    )
}

fn parse_extensions(raw: &Option<String>) -> Option<Vec<String>> {
    let Some(text) = raw else {
        return None;
    };
    let list: Vec<String> = text
        .split(|c: char| c == ',' || c.is_whitespace())
        .map(|s| s.trim().trim_start_matches('.').to_ascii_lowercase())
        .filter(|s| !s.is_empty())
        .collect();
    if list.is_empty() {
        None
    } else {
        Some(list)
    }
}

fn extension_allowed(path: &Path, allowed: &Option<Vec<String>>) -> bool {
    let Some(list) = allowed else {
        return true;
    };
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    list.iter().any(|e| e == &ext)
}

#[tauri::command]
pub fn search_workspace(request: SearchRequest) -> Result<SearchResponse, String> {
    let query = request.query.trim();
    if query.is_empty() {
        return Ok(SearchResponse {
            hits: Vec::new(),
            truncated: false,
            files_scanned: 0,
        });
    }
    if request.roots.is_empty() {
        return Err("No workspace folders to search.".into());
    }

    let max_results = request.max_results.unwrap_or(DEFAULT_MAX_RESULTS).max(1);
    let allowed_ext = parse_extensions(&request.include_extensions);
    let query_cmp = if request.case_sensitive {
        query.to_string()
    } else {
        query.to_lowercase()
    };

    let mut hits = Vec::new();
    let mut truncated = false;
    let mut files_scanned = 0usize;

    'roots: for root in &request.roots {
        let root_path = PathBuf::from(root);
        if !root_path.is_dir() {
            continue;
        }

        for entry in WalkDir::new(&root_path)
            .into_iter()
            .filter_entry(|e| {
                if e.file_type().is_dir() {
                    let name = e.file_name().to_string_lossy();
                    !should_skip_dir(&name)
                } else {
                    true
                }
            })
        {
            let entry = match entry {
                Ok(e) => e,
                Err(_) => continue,
            };
            if !entry.file_type().is_file() {
                continue;
            }

            let path = entry.path();
            if is_probably_binary_ext(path) || !extension_allowed(path, &allowed_ext) {
                continue;
            }

            let meta = match std::fs::metadata(path) {
                Ok(m) => m,
                Err(_) => continue,
            };
            if meta.len() > MAX_FILE_BYTES {
                continue;
            }

            let mut file = match File::open(path) {
                Ok(f) => f,
                Err(_) => continue,
            };

            let mut probe = [0u8; 512];
            let n = file.read(&mut probe).unwrap_or(0);
            if probe[..n].contains(&0) {
                continue;
            }

            // Rewind and scan lines
            let file = match File::open(path) {
                Ok(f) => f,
                Err(_) => continue,
            };

            files_scanned += 1;
            let reader = BufReader::new(file);

            for (idx, line_res) in reader.lines().enumerate() {
                let Ok(line) = line_res else { break };
                if line.len() > 4000 {
                    continue;
                }

                let hay = if request.case_sensitive {
                    line.clone()
                } else {
                    line.to_lowercase()
                };

                if let Some(col) = hay.find(&query_cmp) {
                    let preview: String = line.chars().take(240).collect();
                    hits.push(SearchHit {
                        path: path.to_string_lossy().to_string(),
                        line: idx + 1,
                        column: col + 1,
                        preview,
                    });
                    if hits.len() >= max_results {
                        truncated = true;
                        break 'roots;
                    }
                }
            }
        }
    }

    Ok(SearchResponse {
        hits,
        truncated,
        files_scanned,
    })
}
