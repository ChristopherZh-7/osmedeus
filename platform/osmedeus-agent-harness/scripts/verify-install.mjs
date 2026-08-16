import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import {
  dshBinary,
  installedDSHManifest,
  sidecarManifest,
} from "./runtime.mjs";

const requestedVersion = sidecarManifest().dependencies["@deepseek-ai/dsh"];
const installedVersion = installedDSHManifest().version;
const binaryVersion = execFileSync(dshBinary, ["--version"], {
  encoding: "utf8",
}).trim();

if (requestedVersion !== installedVersion || installedVersion !== binaryVersion) {
  throw new Error(
    `Harness version mismatch: package=${requestedVersion}, installed=${installedVersion}, binary=${binaryVersion}`,
  );
}

if (!existsSync(resolve("skills", "osmedeus-pentest", "SKILL.md"))) {
  throw new Error("Osmedeus pentest Skill bundle is missing");
}

console.log(`DeepSeek Harness ${installedVersion} is installed and version-locked.`);
