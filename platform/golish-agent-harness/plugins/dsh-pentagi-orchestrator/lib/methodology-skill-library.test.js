import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  METHODOLOGY_SKILL_NOTICE,
  MethodologySkillLibrary,
  buildMethodologySkillIndex,
  defaultMethodologySkillRoot,
  isMethodologySkillName,
  parseMethodologySkill,
  searchMethodologySkillIndex,
} from "./methodology-skill-library.js";

const skill = ({ name, description, body, extra = "" }) => `---
name: ${name}
description: "${description}"
${extra}---

# ${name}

${body}
`;

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "golish-methodology-index-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const injection = join(root, "WEB", "OWASP", "sqli");
  const auth = join(root, "WEB", "OWASP", "auth");
  const malformed = join(root, "bad");
  await Promise.all([
    mkdir(injection, { recursive: true }),
    mkdir(auth, { recursive: true }),
    mkdir(malformed, { recursive: true }),
  ]);
  await Promise.all([
    writeFile(join(injection, "SKILL.md"), skill({
      name: "wstg-inpv-05",
      description: "Testing for SQL Injection",
      body: "Use low-impact SQL injection probes.",
      extra: "category: input-validation\nowasp_id: WSTG-INPV-05\ntags: [sqli, injection]\ntech_stack: [mysql]\ncwe_ids: [CWE-89]\nchains_with: [wstg-authz-02]\nseverity_boost: {wstg-authz-02: critical-chain}\n",
    })),
    writeFile(join(auth, "SKILL.md"), skill({
      name: "wstg-athn-01",
      description: "Testing authentication transport",
      body: "Inspect credential transport.",
      extra: "category: authentication\ntags: [authentication]\nprerequisites: [wstg-info-01]\n",
    })),
    writeFile(join(malformed, "SKILL.md"), "# missing frontmatter\n"),
  ]);
  return root;
}

test("Methodology parser separates metadata from lazily loaded instructions", () => {
  const parsed = parseMethodologySkill(skill({
    name: "attack-example",
    description: "Example attack",
    body: "Only this body is loaded.",
    extra: "tags: [example]\n",
  }));
  assert.equal(parsed.name, "attack-example");
  assert.deepEqual(parsed.tags, ["example"]);
  assert.match(parsed.content, /Only this body is loaded/);
  assert.doesNotMatch(parsed.content, /^---/);
});

test("Methodology index accepts legacy CIS display names without using them as paths", () => {
  assert.equal(isMethodologySkillName("CIS Ubuntu 14.04 LTS - 1.1.1.1 Ensure cramfs is disabled"), true);
  assert.equal(isMethodologySkillName("bad\nname"), false);
});

test("Methodology index recursively discovers nested Skills and skips malformed files", async (t) => {
  const root = await fixture(t);
  const index = await buildMethodologySkillIndex(root);
  assert.equal(index.available, true);
  assert.equal(index.entries.length, 2);
  assert.equal(index.skipped, 1);
  assert.ok(index.byName.has("wstg-inpv-05"));
});

test("Methodology search ranks names and filters category, CWE, tag, and technology", async (t) => {
  const index = await buildMethodologySkillIndex(await fixture(t));
  assert.equal(searchMethodologySkillIndex(index, { query: "sqli" }).items[0].name, "wstg-inpv-05");
  assert.equal(searchMethodologySkillIndex(index, { category: "authentication" }).items[0].name, "wstg-athn-01");
  assert.equal(searchMethodologySkillIndex(index, { cwe: "cwe-89" }).items[0].name, "wstg-inpv-05");
  assert.equal(searchMethodologySkillIndex(index, { tag: "injection" }).items[0].name, "wstg-inpv-05");
  assert.equal(searchMethodologySkillIndex(index, { tech: ["mysql"] }).items[0].name, "wstg-inpv-05");
});

test("Methodology library loads one indexed body with the Golish scope notice", async (t) => {
  const library = new MethodologySkillLibrary({ root: await fixture(t) });
  const loaded = await library.load("wstg-inpv-05");
  assert.equal(loaded.provider, "methodology-index");
  assert.match(loaded.content, new RegExp(METHODOLOGY_SKILL_NOTICE.slice(0, 30).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(loaded.content, /low-impact SQL injection probes/);
  assert.deepEqual((await library.chains("wstg-inpv-05")).chains_with, [
    { target: "wstg-authz-02", severity_boost: "critical-chain" },
  ]);
});

test("Methodology library reports an absent optional corpus without failing DSH", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "golish-methodology-missing-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const status = await new MethodologySkillLibrary({ root: join(root, "missing") }).status();
  assert.deepEqual(status, {
    action: "status",
    provider: "methodology-index",
    available: false,
    indexed: 0,
    skipped: 0,
    duplicate_names: [],
  });
});

test("Methodology default root stays outside the active DSH Skill catalog", () => {
  assert.equal(
    defaultMethodologySkillRoot({ DSH_HOME: "/tmp/example-dsh" }),
    "/tmp/example-dsh/golish/methodology-skills",
  );
});
