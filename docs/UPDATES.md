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

## Sign a release build (Windows)

PowerShell:

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = (Get-Content -Raw src-tauri\keys\aether.key)
# optional: $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "..."
npm run tauri:build
```

With `bundle.createUpdaterArtifacts: true`, the build produces installer artifacts plus `.sig` files under `src-tauri/target/release/bundle/`.

## `latest.json` feed

Endpoint configured in `tauri.conf.json`:

`https://github.com/Order-Code67/aether/releases/latest/download/latest.json`

After a signed build, copy NSIS artifacts into `release/` and regenerate the feed:

```powershell
# Copy from cargo target …/bundle/nsis/ if needed, then:
.\scripts\make-latest-json.ps1 -Version 0.1.0 -Notes "First release."
```

Ship on the GitHub Release (tag `v0.1.0`) at least:

- `Aether_0.1.0_x64-setup.exe`
- `latest.json` (from `release/latest.json`)

Optional: MSI + `.sig` files. Template:

```json
{
  "version": "0.1.1",
  "notes": "Bug fixes and improvements.",
  "pub_date": "2026-04-10T12:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "<contents of Aether_0.1.1_x64-setup.exe.sig>",
      "url": "https://github.com/aether-ide/aether/releases/download/v0.1.1/Aether_0.1.1_x64-setup.exe"
    }
  }
}
```

Notes:

- `signature` must be the **literal `.sig` file contents**, not a path/URL.
- `version` must be SemVer greater than the installed app for an update to offer.
- Until the feed exists, **Check for Updates** reports that the feed is unavailable (expected).

## In-app

- Settings → About → **Check for Updates** / **Download & Install**
- Help menu → **Check for Updates…**
- Command Palette → **Help: Check for Updates**
