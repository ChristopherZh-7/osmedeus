import assert from "node:assert/strict";
import test from "node:test";

import {
  interactiveRoleTools,
  pentagiQueueProjectionDefinition,
  pentestPrimaryPrompt,
  pentestRootToolDenial,
} from "./index.js";

test("collaboration mode keeps root Primary executable and exposes only controlled delegation", () => {
  assert.equal(pentestRootToolDenial("orchestrated", "bash"), undefined);
  assert.equal(pentestRootToolDenial("orchestrated", "pentagi_delegate"), undefined);
  assert.match(pentestRootToolDenial("orchestrated", "subagent"), /pentagi_delegate/);
  assert.match(pentestRootToolDenial("orchestrated", "golish_start_pentest_task"), /legacy background/);
});

test("analysis Primary may read context but may not execute or delegate", () => {
  assert.equal(pentestRootToolDenial("analysis", "pentagi_context"), undefined);
  assert.equal(pentestRootToolDenial("analysis", "pentagi_skill"), undefined);
  assert.match(pentestRootToolDenial("analysis", "bash"), /read-only analysis/);
  assert.match(pentestRootToolDenial("analysis", "pentagi_delegate"), /read-only analysis/);
});

test("solo mode keeps Primary tools and blocks every delegation surface", () => {
  assert.equal(pentestRootToolDenial("direct", "bash"), undefined);
  assert.equal(pentestRootToolDenial("direct", "pentagi_skill"), undefined);
  assert.match(pentestRootToolDenial("direct", "pentagi_delegate"), /Solo mode/);
  assert.match(pentestRootToolDenial("direct", "subagent_fork"), /Solo mode/);
  assert.match(pentestRootToolDenial("direct", "workflow"), /Solo mode/);
});

test("root persona is Primary and describes the selected collaboration contract", () => {
  assert.match(pentestPrimaryPrompt("orchestrated"), /single operator-facing agent/);
  assert.match(pentestPrimaryPrompt("orchestrated"), /pentagi_delegate/);
  assert.match(pentestPrimaryPrompt("orchestrated"), /pentagi_skill search/);
  assert.match(pentestPrimaryPrompt("direct"), /Solo mode/);
});

test("interactive specialist runs exclude task-bound memory tools", () => {
  const tools = interactiveRoleTools("pentester");
  assert.ok(tools.includes("bash"));
  assert.ok(tools.includes("pentagi_context"));
  assert.ok(!tools.includes("pentagi_memory_search"));
  assert.ok(!tools.includes("pentagi_memory_write"));
});

test("pentagi queue projection follows the durable next-turn inbox", () => {
  const first = {
    id: "message-1",
    source: { kind: "user" },
    content: [{ type: "text", text: "先完成当前检查" }],
  };
  const second = {
    id: "message-2",
    source: { kind: "user" },
    content: [{ type: "text", text: "然后生成报告" }],
  };
  let state = pentagiQueueProjectionDefinition.init();
  state = pentagiQueueProjectionDefinition.apply(state, {
    type: "agent/inbox/spliced",
    data: { target: "next-turn", start: 0, inserted: [first, second] },
  });
  assert.deepEqual(pentagiQueueProjectionDefinition.view(state), [
    { id: "message-1", messageId: "message-1", placement: "queued", preview: "先完成当前检查", text: "先完成当前检查" },
    { id: "message-2", messageId: "message-2", placement: "queued", preview: "然后生成报告", text: "然后生成报告" },
  ]);

  state = pentagiQueueProjectionDefinition.apply(state, {
    type: "agent/inbox/spliced",
    data: { target: "next-turn", start: 0, removedCount: 1, inserted: [] },
  });
  assert.deepEqual(pentagiQueueProjectionDefinition.view(state).map((item) => item.id), ["message-2"]);

  const unchanged = pentagiQueueProjectionDefinition.apply(state, {
    type: "agent/inbox/spliced",
    data: { target: "next-step", start: 0, inserted: [first] },
  });
  assert.equal(unchanged, state);
});
