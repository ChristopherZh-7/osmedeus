import { cpSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";

import {
  dshBinary,
  parsePort,
  resolvedMethodologySkillRoot,
} from "./runtime.mjs";

const host = process.env.GOLISH_DSH_HOST || "127.0.0.1";
const port = parsePort(process.env.GOLISH_DSH_PORT || "3080");
const defaultHome = join(homedir(), "golish-base", "agent-harness", "dsh-home");
const dshHome = resolve(process.env.DSH_HOME || defaultHome);
const workspaceInput =
  process.env.GOLISH_DSH_WORKSPACE || join(dshHome, "runtime-workspace");
const workspace = isAbsolute(workspaceInput)
  ? workspaceInput
  : resolve(dshHome, workspaceInput);

mkdirSync(dshHome, { recursive: true });
mkdirSync(workspace, { recursive: true });

const runtimeEnv = {
  ...process.env,
  DSH_HOME: dshHome,
  DSH_PERMISSION_MODE: process.env.DSH_PERMISSION_MODE || "workspace-write",
  DSH_TELEMETRY_MODE: process.env.DSH_TELEMETRY_MODE || "DISABLED",
  GOLISH_METHODOLOGY_SKILLS_DIR: resolvedMethodologySkillRoot(),
};

// DSH profiles are independent package roots below $DSH_HOME. Initialize the
// shipped Web profile, then install our versioned local plugin into the profile
// fallback tree that Node's package resolver walks. Copying (instead of
// mutating DSH's own installation) keeps upgrades replaceable and deterministic.
const initialize = spawnSync(
  dshBinary,
  ["--profile", "web", "--dump-default-config"],
  { cwd: workspace, env: runtimeEnv, encoding: "utf8" }
);
if (initialize.status !== 0) {
  process.stderr.write(initialize.stderr || "failed to initialize the DSH web profile\n");
  process.exit(initialize.status ?? 1);
}

const pluginSource = resolve("plugins/dsh-golish-plugin");
const pluginTarget = join(
  dshHome,
  "profiles",
  "node_modules",
  "@golish",
  "dsh-plugin"
);
mkdirSync(join(pluginTarget, ".."), { recursive: true });
rmSync(pluginTarget, { recursive: true, force: true });
cpSync(pluginSource, pluginTarget, { recursive: true });

const orchestratorSource = resolve("plugins/dsh-pentagi-orchestrator");
const orchestratorTarget = join(
  dshHome,
  "profiles",
  "node_modules",
  "@golish",
  "dsh-pentagi-orchestrator"
);
rmSync(orchestratorTarget, { recursive: true, force: true });
cpSync(orchestratorSource, orchestratorTarget, { recursive: true });

// Install Golish-owned Skills into DSH's official user root. Only names
// shipped by this sidecar are replaced, preserving any operator-authored
// bundles already present in $DSH_HOME/skills.
const skillsSource = resolve("skills");
const skillsTarget = join(dshHome, "skills");
mkdirSync(skillsTarget, { recursive: true });
for (const entry of readdirSync(skillsSource, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const source = join(skillsSource, entry.name);
  const target = join(skillsTarget, entry.name);
  rmSync(target, { recursive: true, force: true });
  cpSync(source, target, { recursive: true });
}

const args = ["--patch", resolve("scripts/golish.patch.yml")];
if (process.env.GOLISH_DSH_PATCH) {
  args.push("--patch", resolve(process.env.GOLISH_DSH_PATCH));
}
args.push("--profile", "web", "--host", host, "--port", String(port));
for (const authority of (process.env.GOLISH_DSH_TRUSTED_HOST || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean)) {
  args.push("--trusted-host", authority);
}
const child = spawn(dshBinary, args, {
  cwd: workspace,
  env: runtimeEnv,
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (!child.killed) {
      child.kill(signal);
    }
  });
}

child.on("error", (error) => {
  console.error(`failed to start DeepSeek Harness: ${error.message}`);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  process.exitCode = signal ? 0 : (code ?? 1);
});
