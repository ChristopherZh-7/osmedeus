import { lstat, mkdir, readdir, readlink, rename, stat, symlink } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { buildMethodologySkillIndex } from "../plugins/dsh-pentagi-orchestrator/lib/methodology-skill-library.js";

function usage() {
  return "Usage: node scripts/link-methodology-skills.mjs <repository or Skill directory> [--force]";
}

async function isDirectory(path) {
  try {
    return (await stat(path)).isDirectory();
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function sourceRoot(input) {
  const direct = resolve(input);
  if (await isDirectory(direct)) {
    const hiddenDirectories = (await readdir(direct, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && entry.name.startsWith("."))
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of hiddenDirectories) {
      const nested = join(direct, entry.name, "skill");
      if (await isDirectory(nested)) return nested;
    }
    return direct;
  }
  throw new Error(`Methodology Skill source does not exist: ${direct}`);
}

async function existingTarget(path) {
  try {
    return await lstat(path);
  } catch (error) {
    if (error?.code === "ENOENT") return undefined;
    throw error;
  }
}

const sourceInput = process.argv.slice(2).find((argument) => !argument.startsWith("--"));
if (!sourceInput) throw new Error(usage());
const force = process.argv.includes("--force");
const source = await sourceRoot(sourceInput);
const dshHome = resolve(process.env.DSH_HOME || join(homedir(), "golish-base", "agent-harness", "dsh-home"));
const target = join(dshHome, "golish", "methodology-skills");
const startedAt = performance.now();
const index = await buildMethodologySkillIndex(source);
if (!index.available || index.entries.length === 0) {
  throw new Error(`No valid Methodology Skills were found below ${source}`);
}

await mkdir(dirname(target), { recursive: true });
const current = await existingTarget(target);
let backup = "";
if (current?.isSymbolicLink()) {
  const linked = resolve(dirname(target), await readlink(target));
  if (linked === source) {
    console.log(JSON.stringify({
      status: "already-linked",
      source,
      target,
      indexed: index.entries.length,
      skipped: index.skipped,
      duplicate_names: index.duplicateNames.length,
      elapsed_ms: Math.round(performance.now() - startedAt),
    }, null, 2));
    process.exit(0);
  }
}
if (current) {
  if (!force) {
    throw new Error(`${target} already exists; rerun with --force to move it to a timestamped backup`);
  }
  backup = `${target}.previous-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  await rename(target, backup);
}

await symlink(source, target, process.platform === "win32" ? "junction" : "dir");
console.log(JSON.stringify({
  status: "linked",
  source,
  target,
  backup,
  indexed: index.entries.length,
  skipped: index.skipped,
  duplicate_names: index.duplicateNames.length,
  elapsed_ms: Math.round(performance.now() - startedAt),
}, null, 2));
