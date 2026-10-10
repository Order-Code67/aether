/**
 * Normalize GitHub library specs for PlatformIO `lib_deps` / `pio pkg install -l`.
 * Accepts full URLs or `owner/repo` (+ optional `#branch` / `.git`).
 */

const OWNER_REPO =
  /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?(?:#([A-Za-z0-9_./~+-]+))?$/;

const GITHUB_URL =
  /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?(?:\/)?(?:#([A-Za-z0-9_./~+-]+))?$/i;

export type GithubLibParseResult =
  | { ok: true; spec: string; label: string }
  | { ok: false; error: "empty" | "invalid" };

export function isGithubLibSpec(value: string): boolean {
  const t = value.trim();
  if (!t) return false;
  if (GITHUB_URL.test(t)) return true;
  if (t.startsWith("https://github.com/") || t.startsWith("http://github.com/"))
    return true;
  return OWNER_REPO.test(t) && !t.includes(" ");
}

export function parseGithubLibSpec(input: string): GithubLibParseResult {
  const raw = input.trim();
  if (!raw) return { ok: false, error: "empty" };

  if (raw.includes("..") || raw.includes("\\") || raw.includes("\0")) {
    return { ok: false, error: "invalid" };
  }

  // Reject non-https schemes early
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^https:\/\//i.test(raw)) {
    return { ok: false, error: "invalid" };
  }

  let owner: string | undefined;
  let repo: string | undefined;
  let ref: string | undefined;

  const urlMatch = raw.match(GITHUB_URL);
  if (urlMatch) {
    owner = urlMatch[1];
    repo = urlMatch[2];
    ref = urlMatch[3];
  } else {
    const short = raw.match(OWNER_REPO);
    if (short && !raw.includes("://")) {
      owner = short[1];
      repo = short[2];
      ref = short[3];
    }
  }

  if (!owner || !repo) {
    return { ok: false, error: "invalid" };
  }

  // Strip trailing .git from repo name if regex left it (shouldn't)
  const cleanRepo = repo.replace(/\.git$/i, "");
  if (!cleanRepo || owner.length > 100 || cleanRepo.length > 100) {
    return { ok: false, error: "invalid" };
  }

  let spec = `https://github.com/${owner}/${cleanRepo}.git`;
  if (ref) {
    if (ref.length > 120 || !/^[A-Za-z0-9_./~+-]+$/.test(ref)) {
      return { ok: false, error: "invalid" };
    }
    spec += `#${ref}`;
  }

  if (spec.length > 400) {
    return { ok: false, error: "invalid" };
  }

  return {
    ok: true,
    spec,
    label: ref ? `${owner}/${cleanRepo}#${ref}` : `${owner}/${cleanRepo}`,
  };
}
