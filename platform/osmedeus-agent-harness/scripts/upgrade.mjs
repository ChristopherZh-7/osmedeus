import { spawnSync } from "node:child_process";

import { sidecarRoot } from "./runtime.mjs";

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error(
    "usage: npm run upgrade:dsh -- <exact-version>\nexample: npm run upgrade:dsh -- 0.1.0-rc.7",
  );
  process.exit(2);
}

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const install = spawnSync(
  npmCommand,
  ["install", "--save-exact", `@deepseek-ai/dsh@${version}`],
  { cwd: sidecarRoot, stdio: "inherit" },
);
if (install.status !== 0) {
  process.exit(install.status ?? 1);
}

const verify = spawnSync(npmCommand, ["run", "verify:install"], {
  cwd: sidecarRoot,
  stdio: "inherit",
});
process.exit(verify.status ?? 1);
