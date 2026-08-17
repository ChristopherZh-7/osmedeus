import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import {
  dshBinary,
  installedDSHManifest,
  sidecarManifest,
} from "./runtime.mjs";
import { ROLE_REGISTRY } from "../plugins/dsh-pentagi-orchestrator/lib/roles.js";

const supportedSchemaKeywords = new Set([
  "type", "oneOf", "properties", "required", "additionalProperties", "items",
  "enum", "const", "title", "description", "default", "examples",
]);

function verifyHarnessSchema(schema, path) {
  for (const [keyword, value] of Object.entries(schema)) {
    if (!supportedSchemaKeywords.has(keyword)) {
      throw new Error(`${path}.${keyword} is not supported by the pinned Harness JSON Schema subset`);
    }
    if (keyword === "properties") {
      for (const [name, property] of Object.entries(value)) {
        verifyHarnessSchema(property, `${path}.properties.${name}`);
      }
    } else if (keyword === "items" && value && typeof value === "object") {
      verifyHarnessSchema(value, `${path}.items`);
    } else if (keyword === "oneOf" && Array.isArray(value)) {
      value.forEach((branch, index) => verifyHarnessSchema(branch, `${path}.oneOf[${index}]`));
    }
  }
}

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

if (!existsSync(resolve("plugins", "dsh-pentagi-orchestrator", "lib", "roles.js"))) {
  throw new Error("Osmedeus PentAGI role registry is missing");
}

if (!existsSync(resolve("plugins", "dsh-pentagi-orchestrator", "lib", "cyberstrike-skill-library.js"))) {
  throw new Error("Osmedeus CyberStrike Skill index adapter is missing");
}

if (!existsSync(resolve("scripts", "link-cyberstrike-skills.mjs"))) {
  throw new Error("Osmedeus CyberStrike Skill link helper is missing");
}

for (const [roleID, definition] of Object.entries(ROLE_REGISTRY)) {
  verifyHarnessSchema(definition.schema, `roles.${roleID}.schema`);
  if (definition.tools.includes("skill")) {
    throw new Error(`roles.${roleID} must use pentagi_skill instead of the root-only skill tool`);
  }
  if (!["reflector", "summarizer", "tool_call_fixer"].includes(roleID)) {
    for (const requiredTool of ["pentagi_skill", "pentagi_context"]) {
      if (!definition.tools.includes(requiredTool)) {
        throw new Error(`roles.${roleID} is missing required managed tool ${requiredTool}`);
      }
    }
  }
}

for (const roleID of ["generator", "refiner"]) {
  const definition = ROLE_REGISTRY[roleID];
  const sideEffectTools = new Set([
    "pentagi_delegate", "pentagi_memory_write", "osmedeus_record_test",
    "osmedeus_submit_finding", "bash", "write", "edit",
  ]);
  const leaked = definition.tools.filter((tool) => sideEffectTools.has(tool));
  if (leaked.length || definition.delegates.length) {
    throw new Error(`roles.${roleID} must remain a side-effect-free planner`);
  }
}

console.log(`DeepSeek Harness ${installedVersion} is installed and version-locked.`);
