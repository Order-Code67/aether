# Publishing Aether updates

Aether uses [`tauri-plugin-updater`](https://v2.tauri.app/plugin/updater/) with a **static JSON** feed and **minisign** signatures.

## Keys

- Public key is embedded in [`src-tauri/tauri.conf.json`](../src-tauri/tauri.conf.json) (`plugins.updater.pubkey`).
- Private key lives at `src-tauri/keys/aether.key` (gitignored). Never commit it.
- Public companion: `src-tauri/keys/aether.key.pub` (safe to commit).

Generate a new pair only if you are rotating keys (existing installs will not accept updates signed with a new private key unless you also ship a pubkey migration):

```bash
npx tauri signer generate -w src-tauri/keys/aether.key --ci -f
# paste the new public key string into tauri.conf.json → plugins.updater.pubkey
```

## Channels (Stable / Beta)

Settings → About → **Updates** has a channel selector (persisted):

| Channel | Feed URL |
|---------|----------|
| **Stable** | `https://github.com/Order-Code67/aether/releases/latest/download/latest.json` |
| **Beta** | `https://github.com/Order-Code67/aether/releases/latest/download/latest-beta.json` |

Quiet startup checks and manual **Check for Updates** both respect the selected channel. The update dialog shows a **Beta** badge when the Beta channel is selected.

### Publishing a real Beta (prerelease)

GitHub `/releases/latest/` only serves the latest **non-prerelease** release. Keep both feed files as assets on that stable release, but point their `url`s appropriately:

1. Build and publish **stable** `vX.Y.Z` with signed `Aether_X.Y.Z_x64-setup.exe` + `latest.json` (version = `X.Y.Z`, URL under `…/download/vX.Y.Z/…`).
2. Bump app version to a SemVer prerelease (e.g. `X.Y.Z-beta.1`), signed-build **NSIS only** (`npx tauri build --bundles nsis` — MSI rejects non-numeric prerelease identifiers), publish a **GitHub prerelease** tag `vX.Y.Z-beta.1` with that installer + `.sig`.
3. Generate `latest-beta.json` with `-BetaVersion X.Y.Z-beta.1` so it points at the prerelease assets.
4. Upload `latest-beta.json` onto the **stable** release assets (so Beta clients can fetch it via `/releases/latest/download/latest-beta.json`).
5. Never point `latest.json` at a prerelease installer.

```powershell
.\scripts\make-latest-json.ps1 -Version 0.2.17 -Notes "Stable notes." -StableOnly
.\scripts\make-latest-json.ps1 -BetaVersion 0.2.17-beta.1 -BetaNotes "Beta notes." -BetaOnly
```

## Sign a release build (Windows)

PowerShell:

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = (Get-Content -Raw src-tauri\keys\aether.key)
# optional: $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "..."
npm run tauri:build
```

With `bundle.createUpdaterArtifacts: true`, the build produces installer artifacts plus `.sig` files under `src-tauri/target/release/bundle/`.

## Feed JSON

Default endpoint in `tauri.conf.json` remains the stable `latest.json` (fallback). Runtime checks use the channel-specific URL via a Rust command.

After a signed build, copy NSIS artifacts into `release/` and regenerate feeds:

```powershell
.\scripts\make-latest-json.ps1 -Version 0.2.17 -Notes "Release notes." -BetaVersion 0.2.17-beta.1 -BetaNotes "Beta notes."
```

Ship on the GitHub Release (tag `v0.2.17`) at least:

- `Aether_0.2.17_x64-setup.exe`
- `latest.json`
- `latest-beta.json` (may point at `v0.2.17-beta.1` assets)

And on the prerelease tag `v0.2.17-beta.1`:

- `Aether_0.2.17-beta.1_x64-setup.exe` (+ `.sig`)

Optional: MSI + `.sig` files. Offline PlatformIO cache zip is separate — see [`OFFLINE_INSTALLER.md`](./OFFLINE_INSTALLER.md).

Template:

```json
{
  "version": "0.2.17",
  "notes": "Bug fixes and improvements.",
  "pub_date": "2026-10-11T12:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "<contents of Aether_0.2.17_x64-setup.exe.sig>",
      "url": "https://github.com/Order-Code67/aether/releases/download/v0.2.17/Aether_0.2.17_x64-setup.exe"
    }
  }
}
```

Notes:

- `signature` must be the **literal `.sig` file contents**, not a path/URL.
- `version` must be SemVer greater than the installed app for an update to offer.
- Until the feed exists, **Check for Updates** reports that the feed is unavailable (expected).

## In-app

- Settings → About → **Updates** — channel, Check for Updates, Download & Install
- Help menu → **Check for Updates…**
- Command Palette → **Help: Check for Updates**
