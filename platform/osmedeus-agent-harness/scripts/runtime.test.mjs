import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  bundledCyberStrikeSkillRoot,
  resolvedCyberStrikeSkillRoot,
} from "./runtime.mjs";

test("Harness defaults the CyberStrike index to the bundled corpus", () => {
  const root = bundledCyberStrikeSkillRoot();
  assert.equal(resolvedCyberStrikeSkillRoot({}), root);
  assert.equal(existsSync(root), true);
});

test("Harness permits an explicit CyberStrike corpus override", () => {
  assert.equal(
    resolvedCyberStrikeSkillRoot({ OSM_CYBERSTRIKE_SKILLS_DIR: "./custom-corpus" }),
    resolve("./custom-corpus"),
  );
});
