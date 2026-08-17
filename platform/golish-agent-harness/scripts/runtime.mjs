import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = dirname(fileURLToPath(import.meta.url));

export const sidecarRoot = resolve(scriptsDir, "..");

export function bundledMethodologySkillRoot() {
  return join(sidecarRoot, "vendor", "methodology-skills");
}

export function resolvedMethodologySkillRoot(env = process.env) {
  return resolve(
    String(env.GOLISH_METHODOLOGY_SKILLS_DIR || bundledMethodologySkillRoot()),
  );
}

export const dshBinary = join(
  sidecarRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "dsh.cmd" : "dsh",
);

export function readJSON(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function sidecarManifest() {
  return readJSON(join(sidecarRoot, "package.json"));
}

export function installedDSHManifest() {
  return readJSON(
    join(sidecarRoot, "node_modules", "@deepseek-ai", "dsh", "package.json"),
  );
}

export function parsePort(value) {
  const port = Number.parseInt(value, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`invalid Harness port: ${JSON.stringify(value)}`);
  }
  return port;
}

export function harnessURL() {
  if (process.env.GOLISH_DSH_URL) {
    return new URL(process.env.GOLISH_DSH_URL).toString().replace(/\/$/, "");
  }

  const host = process.env.GOLISH_DSH_HOST || "127.0.0.1";
  const port = parsePort(process.env.GOLISH_DSH_PORT || "3080");
  const connectHost = host === "0.0.0.0" || host === "::" ? "127.0.0.1" : host;
  return `http://${connectHost}:${port}`;
}
