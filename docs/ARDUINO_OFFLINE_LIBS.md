# Arduino offline libraries (Aether)

Curated **Arduino Library Manager** packs for offline work, kept **inside Aether’s data dir** and refreshed online when needed.

> This is **not** every library ever published on Arduino’s registry (thousands of packages / multi‑GB). Aether ships a practical set (Servo, sensors, displays, LoRa, …). Anything else: Libraries → Arduino → search/install while online — installs also land in the same offline store.

## Where files live

| Item | Path |
|------|------|
| Offline store | `%LOCALAPPDATA%\Aether\arduino-user\libraries\` |
| Optional index copy | `%LOCALAPPDATA%\Aether\arduino-user\library_index.json` |
| Dist zip | `release/Aether_ArduinoLibs_<ver>_windows-x64.zip` |

Compile via Arduino CLI also passes `--libraries` for this store (plus the project `lib/`).

## In the app

**Settings → Tools → Arduino libraries (offline store)**

| Action | What it does |
|--------|----------------|
| **Download offline libs** | `lib update-index` + install curated list into the store (needs internet; progress in Output) |
| **Update online** | Refresh index + `lib upgrade` for already installed offline libs |
| **Import zip…** | Merge `Aether_ArduinoLibs_*.zip` into the store |
| **Import pack next to app** | Same for a zip found next to Aether / Desktop / Downloads |

Libraries panel (Arduino tab) search uses the registry when online; if the network fails, it lists matching folders from the offline store. Install always writes into the offline store **and** copies into the project `lib/`.

## Maintainer: build the zip

```powershell
npm run build:arduino-offline-libs
# → release/Aether_ArduinoLibs_<version>_windows-x64.zip
```

Requires `arduino-cli` on PATH. Optionally drop the zip into the USB dist folder (`npm run package:dist`) or next to `Aether.exe`.

## Related

- PlatformIO platforms/toolchains: [`OFFLINE_INSTALLER.md`](./OFFLINE_INSTALLER.md) (`Aether_OfflineCache_*` / `OfflineLibs_*`)
- Arduino CLI cores: Settings → Tools → Install AVR + ESP32 cores
