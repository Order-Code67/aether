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

Quiet startup checks and manual **Check for Updates** both respect the selected channel. The update dialog shows the channel name.

### Publishing both feeds

On each release, upload **both** `latest.json` and `latest-beta.json` as assets on the GitHub Release (tag `vX.Y.Z`). Until a true prerelease exists, both may point at the same signed installer.

When you ship a beta-only build:

1. Publish a prerelease (e.g. `v0.3.0-beta.1`) with the signed setup + `.sig`.
2. Update `latest-beta.json` (on the **latest** release assets, or re-upload) so its `url` / `version` / `signature` point at that prerelease artifact.
3. Keep `latest.json` on the last stable build.

`.\scripts\make-latest-json.ps1` writes both files into `release/`.

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
.\scripts\make-latest-json.ps1 -Version 0.2.15 -Notes "Release notes."
```

Ship on the GitHub Release (tag `v0.2.15`) at least:

- `Aether_0.2.15_x64-setup.exe`
- `latest.json`
- `latest-beta.json`

Optional: MSI + `.sig` files. Offline PlatformIO cache zip is separate — see [`OFFLINE_INSTALLER.md`](./OFFLINE_INSTALLER.md).

Template:

```json
{
  "version": "0.2.15",
  "notes": "Bug fixes and improvements.",
  "pub_date": "2026-04-10T12:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "<contents of Aether_0.2.15_x64-setup.exe.sig>",
      "url": "https://github.com/Order-Code67/aether/releases/download/v0.2.15/Aether_0.2.15_x64-setup.exe"
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
