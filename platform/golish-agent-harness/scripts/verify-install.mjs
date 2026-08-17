import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import {
  dshBinary,
  installedDSHManifest,
  readJSON,
  sidecarManifest,
} from "./runtime.mjs";
import { ROLE_REGISTRY } from "../plugins/dsh-pentagi-orchestrator/lib/roles.js";
import { buildMethodologySkillIndex } from "../plugins/dsh-pentagi-orchestrator/lib/methodology-skill-library.js";

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

if (!existsSync(resolve("skills", "golish-pentest", "SKILL.md"))) {
  throw new Error("Golish pentest Skill bundle is missing");
}

if (!existsSync(resolve("plugins", "dsh-pentagi-orchestrator", "lib", "roles.js"))) {
  throw new Error("Golish PentAGI role registry is missing");
}

if (!existsSync(resolve("plugins", "dsh-pentagi-orchestrator", "lib", "methodology-skill-library.js"))) {
  throw new Error("Golish Methodology Skill index adapter is missing");
}

if (!existsSync(resolve("scripts", "link-methodology-skills.mjs"))) {
  throw new Error("Golish Methodology Skill link helper is missing");
}

const methodologySource = readJSON(resolve("vendor", "methodology-source.json"));
const methodologyIndex = await buildMethodologySkillIndex(
  resolve("vendor", "methodology-skills"),
);
if (!methodologyIndex.available) {
  throw new Error("Bundled Methodology Skill corpus is missing");
}
if (methodologyIndex.entries.length !== methodologySource.indexed_skills) {
  throw new Error(
    `Bundled Methodology index mismatch: expected=${methodologySource.indexed_skills}, actual=${methodologyIndex.entries.length}`,
  );
}
if (methodologyIndex.skipped !== methodologySource.skipped_files) {
  throw new Error(
    `Bundled Methodology skipped-file mismatch: expected=${methodologySource.skipped_files}, actual=${methodologyIndex.skipped}`,
  );
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
    "pentagi_delegate", "pentagi_memory_write", "golish_record_test",
    "golish_submit_finding", "bash", "write", "edit",
  ]);
  const leaked = definition.tools.filter((tool) => sideEffectTools.has(tool));
  if (leaked.length || definition.delegates.length) {
    throw new Error(`roles.${roleID} must remain a side-effect-free planner`);
  }
}

console.log(`DeepSeek Harness ${installedVersion} is installed and version-locked.`);
console.log(`Methodology ${methodologySource.ref} is bundled with ${methodologyIndex.entries.length} indexed Skills.`);
