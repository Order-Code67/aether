# Publishing extensions (local hub)

Aether’s **Publish** tab is a lightweight publishing hub: author packages, publish to an in-app catalog, and export files you can host anywhere.

**Signed remote extension store — not yet.** The Extensions panel shows that status; keep local packs, catalog URL, and this hub only. Do not treat Marketplace as a curated App Store.

This is **not** a signed cloud store. Integrity uses an optional SHA-256 content hash; remote install still trusts HTTPS + JSON validation.

## Workflow

1. Activity Bar → **Extensions** → **Publish**
2. Fill id (`publisher.name`), name, version, description
3. Add snippets and/or boards
4. **Publish to Hub** — entry appears in **Marketplace** (merged above the bundled catalog) and is installed locally
5. Optional:
   - **Export Package…** — writes `extension.json` + `README.md` into a new folder
   - Set **Public download URL** to an `https://…/extension.json` before publishing if you will host the file
   - **Export Hub Catalog…** — writes a `catalog.json` you can upload (CDN / GitHub Releases)

## Hosted catalog

Point Marketplace → Catalog URL at your exported `catalog.json`, or merge entries into a repo feed. Entry shape matches the Marketplace catalog (`id`, `name`, `description`, `publisher`, `category`, `downloadUrl`, optional `fallback`, optional `contentHash`).

For installs without a live URL, keep `fallback` (embedded by Publish to Hub) or use `hub://` download URLs that resolve from fallback only.

## Package format

Same as local extensions — see README / `examples/sample-extension/extension.json`.
