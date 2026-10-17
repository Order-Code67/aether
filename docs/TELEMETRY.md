# Opt-in local diagnostics

Aether does **not** send usage or crash data to a remote server by default.

## Settings

**Settings → General → Local diagnostics (opt-in)** — default **OFF**.

When ON, the app may record short, non-PII events such as:

- `build_fail` / `upload_fail` (tool id + coarse error class)

Implementation: [`src/lib/telemetry.ts`](../src/lib/telemetry.ts) — in-memory ring buffer + optional `sessionStorage`. Path-like and email-like strings are redacted.

## What this is not

- Not a cloud analytics product
- Not crash reporting to a vendor
- Not enabled unless the user turns the toggle on

If a future remote endpoint is added, it must remain opt-in and documented here before shipping network calls.
