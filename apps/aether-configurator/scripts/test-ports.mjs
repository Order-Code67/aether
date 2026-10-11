import { listWindowsPortsFallback } from "../electron/serial/windowsPorts.ts";

// Can't import .ts directly — inline the same logic for a smoke test.
import { execFile } from "node:child_process";

function run(file, args) {
  return new Promise((resolve) => {
    execFile(file, args, { encoding: "utf8", windowsHide: true, timeout: 8000 }, (err, stdout) => {
      resolve(String(stdout ?? ""));
    });
  });
}

const script = [
  "$ErrorActionPreference = 'SilentlyContinue'",
  "Get-PnpDevice -Class Ports | ForEach-Object {",
  "  $name = $_.FriendlyName",
  "  if (-not $name) { return }",
  "  Write-Output ($name + [char]9 + $_.Status + [char]9 + $_.InstanceId)",
  "}",
].join("; ");

const stdout = await run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script]);
console.log("--- PnP raw ---");
console.log(stdout);
const ports = [];
for (const line of stdout.split(/\r?\n/)) {
  const t = line.trim();
  if (!t) continue;
  const [name = "", status = ""] = t.split("\t");
  const m = name.match(/\((COM\d+)\)/i);
  if (m) ports.push({ path: m[1].toUpperCase(), name, status });
}
console.log("--- parsed ---");
console.log(ports);
