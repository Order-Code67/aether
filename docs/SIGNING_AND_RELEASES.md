# Signing & releases (Windows)

Aether’s **supported release** is a **lean NSIS** installer plus an **optional separate** offline pack. Toolchains are never baked into the main setup.

## What ships

| Artifact | Role | Size expectation |
|----------|------|------------------|
| `Aether_<ver>_x64-setup.exe` | Signed NSIS app installer | App + runtimes only |
| `Aether_OfflineLibs_<ver>_windows-x64.zip` | Recommended USB / clean-PC libs pack | ~50–80 MB |
| `Aether_OfflineCache_<ver>_windows-x64.zip` | Full offline platforms + toolchains | Multi‑GB (optional) |
| `Aether_Dist_<ver>/` | Folder from `npm run package:dist` | setup + OfflineLibs + `README-FIRST.txt` + this doc copy of CLEAN_WINDOWS |

Updater feeds (`latest.json` / `latest-beta.json`) and minisign `.sig` files: see [`UPDATES.md`](./UPDATES.md).

## Maintainer checklist

1. Set `TAURI_SIGNING_PRIVATE_KEY` from `src-tauri/keys/aether.key` (gitignored).
2. `npm run tauri:build` (NSIS; updater artifacts on).
3. Copy setup (+ `.sig`) into `release/`.
4. Build **OfflineLibs** when you want a USB pack: `npm run build:offline-libs` — **do not** rebuild the multi‑GB OfflineCache unless you need a full air-gap tree.
5. `npm run package:dist` → `release/Aether_Dist_<ver>/` with `README-FIRST.txt`.
6. Publish GitHub Release assets; regenerate feeds with `.\scripts\make-latest-json.ps1`.

## Aligning docs & scripts

- [`CLEAN_WINDOWS.md`](./CLEAN_WINDOWS.md) — end-user ~15 min path
- [`OFFLINE_INSTALLER.md`](./OFFLINE_INSTALLER.md) — zip contents & import
- [`scripts/package-dist.ps1`](../scripts/package-dist.ps1) — assembles Dist folder; does **not** rebuild NSIS or offline zips
- Root [`README.md`](../README.md) — short pitch + release pointers

## Code signing (OS Authenticode)

Tauri/minisign covers **auto-update integrity**. Windows SmartScreen / Authenticode is a separate certificate if you add it later; absence does not change the lean-NSIS + OfflineLibs split.
