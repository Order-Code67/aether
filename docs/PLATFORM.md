# Platform support

## Current focus: Windows

Desktop releases, NSIS installers, OfflineLibs USB packs, COM/serial, and Aether Configurator detection are **Windows-first**. Day-to-day development and smoke paths assume Windows 10/11 x64.

## macOS / Linux

Parity is **on demand / later** — not a full port in this milestone.

- The UI stack (Vite/React) can run in a browser preview on any OS (`npm run dev`), without real serial/filesystem.
- Tauri targets for macOS/Linux are not release-supported yet; serial, ConPTY terminal, NSIS/offline packaging, and Configurator packaging would need dedicated work.
- Contributors exploring other OS builds should treat them as experimental and keep Windows as the CI/release gate.

See also [`CLEAN_WINDOWS.md`](./CLEAN_WINDOWS.md) and [`SIGNING_AND_RELEASES.md`](./SIGNING_AND_RELEASES.md).
