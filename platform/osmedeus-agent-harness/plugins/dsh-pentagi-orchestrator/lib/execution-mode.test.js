import assert from "node:assert/strict";
import test from "node:test";

import { pentestRootToolDenial } from "./index.js";

test("orchestrated roots may control tasks but may not execute bash", () => {
  assert.equal(pentestRootToolDenial("orchestrated", "osmedeus_start_pentest_task"), undefined);
  assert.match(pentestRootToolDenial("orchestrated", "bash"), /osmedeus_start_pentest_task/);
});

test("analysis roots may read context but may not start or execute", () => {
  assert.equal(pentestRootToolDenial("analysis", "pentagi_context"), undefined);
  assert.match(pentestRootToolDenial("analysis", "osmedeus_start_pentest_task"), /read-only analysis/);
  assert.match(pentestRootToolDenial("analysis", "bash"), /read-only analysis/);
});

test("direct roots keep the native Harness tool set", () => {
  assert.equal(pentestRootToolDenial("direct", "bash"), undefined);
});
