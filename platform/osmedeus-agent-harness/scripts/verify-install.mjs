import { execFileSync } from "node:child_process";

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

console.log(`DeepSeek Harness ${installedVersion} is installed and version-locked.`);
