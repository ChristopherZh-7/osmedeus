import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  bundledMethodologySkillRoot,
  resolvedMethodologySkillRoot,
} from "./runtime.mjs";

test("Harness defaults the Methodology index to the bundled corpus", () => {
  const root = bundledMethodologySkillRoot();
  assert.equal(resolvedMethodologySkillRoot({}), root);
  assert.equal(existsSync(root), true);
});

test("Harness permits an explicit Methodology corpus override", () => {
  assert.equal(
    resolvedMethodologySkillRoot({ GOLISH_METHODOLOGY_SKILLS_DIR: "./custom-corpus" }),
    resolve("./custom-corpus"),
  );
});
