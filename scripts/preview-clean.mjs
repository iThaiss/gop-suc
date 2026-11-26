import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { previewEnv } from "./preview-env.mjs";

const require = createRequire(import.meta.url);
const data = path.resolve(".data");
mkdirSync(data, { recursive: true });
const directory = mkdtempSync(path.join(data, "preview-"));
const child = spawn(process.execPath, [
  require.resolve("next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", "3101",
], {
  stdio: "inherit",
  env: previewEnv(process.env, path.join(directory, "gopsuc.sqlite"), "http://127.0.0.1:3101"),
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => child.kill(signal));
}
child.on("error", error => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal === "SIGINT" ? 130 : 1);
});
