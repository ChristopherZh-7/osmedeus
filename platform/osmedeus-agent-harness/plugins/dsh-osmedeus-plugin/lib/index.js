import { createHash, randomUUID } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { defineTool } from "@deepseek-ai/dsh-tools";

const CONTEXT_ROUTE = "/osmedeus/context";
const CONTEXT_STATUS_ROUTE = "/osmedeus/context/status";
const QUESTION_ROUTE = "/osmedeus/questions";
const QUESTION_RESPONSE_ROUTE = "/osmedeus/questions/respond";
const MAX_CONTEXT_BYTES = 16 * 1024 * 1024;
const SESSION_ID_PATTERN = /^session-osm-[a-f0-9]{32}$/;
const bridgeByRootSession = new Map();
const osmedeusAPI = new URL(process.env.OSM_API_URL || "http://127.0.0.1:8002");

export const inject = ["apiProxy", "webServer", "tools", "sessions"];

function sendJSON(res, status, value) {
  const body = Buffer.from(JSON.stringify(value));
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": String(body.length),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

async function readJSONBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_CONTEXT_BYTES) {
      const error = new Error("context payload is too large");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (size === 0) {
    const error = new Error("context payload is required");
    error.statusCode = 400;
    throw error;
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("context payload must be valid JSON");
    error.statusCode = 400;
    throw error;
  }
}

function publicQuestion(question) {
  return {
    id: String(question?.id ?? ""),
    question: String(question?.question ?? ""),
    ...(typeof question?.header === "string" ? { header: question.header } : {}),
    ...(typeof question?.detail === "string" ? { detail: question.detail } : {}),
    ...(Array.isArray(question?.options) ? {
      options: question.options.map((option) => ({
        label: String(option?.label ?? ""),
        ...(typeof option?.description === "string" ? { description: option.description } : {}),
      })),
    } : {}),
    ...(question?.multiSelect === true ? { multi_select: true } : {}),
  };
}

function normalizeQuestionAnswers(pending, input) {
  if (!Array.isArray(input) || input.length !== pending.questions.length) {
    throw new Error("one answer is required for every pending question");
  }
  const byID = new Map(input.map((answer) => [String(answer?.id ?? ""), answer]));
  if (byID.size !== input.length) throw new Error("question answer ids must be unique");

  return pending.questions.map((question) => {
    const answer = byID.get(question.id);
    if (!answer) throw new Error(`missing answer for question ${question.id}`);
    const allowed = new Set((question.options ?? []).map((option) => option.label));
    const selected = Array.isArray(answer.selected)
      ? answer.selected.map((value) => String(value).trim()).filter(Boolean)
      : [];
    if (question.multi_select !== true && question.multiSelect !== true && selected.length > 1) {
      throw new Error(`question ${question.id} accepts only one option`);
    }
    if (selected.some((label) => !allowed.has(label))) {
      throw new Error(`question ${question.id} contains an unknown option`);
    }
    const custom = typeof answer.custom === "string" ? answer.custom.trim() : "";
    if (custom.length > 20_000) throw new Error(`question ${question.id} custom answer is too long`);
    if (selected.length === 0 && custom === "") {
      throw new Error(`question ${question.id} requires a selection or custom answer`);
    }
    return {
      id: question.id,
      selected,
      ...(custom ? { custom } : {}),
    };
  });
}

function registerQuestionBridge(ctx) {
  const pendingBySession = new Map();
  const abort = new AbortController();
  const watch = async () => {
    try {
      for await (const envelope of ctx.apiProxy.events.mux({
        rpcId: randomUUID(),
        payload: {},
      }, abort.signal)) {
        const payload = envelope.payload;
        if (payload?.type === "question/requested" && SESSION_ID_PATTERN.test(payload.sessionId)) {
          pendingBySession.set(payload.sessionId, {
            rpc_id: String(envelope.rpcId),
            session_id: payload.sessionId,
            questions: payload.questions.map(publicQuestion),
          });
          continue;
        }
        if (payload?.type === "question/resolved") {
          const pending = pendingBySession.get(payload.sessionId);
          if (pending?.rpc_id === String(payload.questionRpcId)) pendingBySession.delete(payload.sessionId);
        }
      }
    } catch (error) {
      if (!abort.signal.aborted) console.error("[osmedeus] question bridge stopped:", error);
    }
  };
  void watch();
  ctx.effect(() => () => {
    abort.abort();
    pendingBySession.clear();
  }, "osmedeus: question event bridge");

  ctx.effect(
    () => ctx.webServer.register({
      kind: "exact",
      path: QUESTION_ROUTE,
      handler(req, res) {
        if (req.method !== "GET") {
          res.setHeader("Allow", "GET");
          sendJSON(res, 405, { ok: false, error: "method not allowed" });
          return;
        }
        const requestURL = new URL(req.url || QUESTION_ROUTE, "http://127.0.0.1");
        const sessionId = String(requestURL.searchParams.get("session_id") ?? "").trim();
        if (!SESSION_ID_PATTERN.test(sessionId)) {
          sendJSON(res, 400, { ok: false, error: "invalid Osmedeus DSH session id" });
          return;
        }
        sendJSON(res, 200, {
          ok: true,
          session_id: sessionId,
          pending: pendingBySession.get(sessionId) ?? null,
        });
      },
    }),
    "osmedeus: pending question query",
  );

  ctx.effect(
    () => ctx.webServer.register({
      kind: "exact",
      path: QUESTION_RESPONSE_ROUTE,
      async handler(req, res) {
        if (req.method !== "POST") {
          res.setHeader("Allow", "POST");
          sendJSON(res, 405, { ok: false, error: "method not allowed" });
          return;
        }
        try {
          const payload = await readJSONBody(req);
          const sessionId = String(payload?.session_id ?? "").trim();
          const rpcId = String(payload?.rpc_id ?? "").trim();
          const action = String(payload?.action ?? "answer");
          if (!SESSION_ID_PATTERN.test(sessionId) || !rpcId || rpcId.length > 256) {
            sendJSON(res, 400, { ok: false, error: "invalid question identity" });
            return;
          }
          const pending = pendingBySession.get(sessionId);
          if (!pending || pending.rpc_id !== rpcId) {
            sendJSON(res, 409, { ok: false, error: "question is no longer pending" });
            return;
          }

          let result;
          if (action === "cancel") {
            result = {
              ok: false,
              error: { code: "cancelled", message: "the operator cancelled the question", details: {} },
            };
          } else if (action === "answer") {
            const answers = normalizeQuestionAnswers(pending, payload?.answers);
            result = {
              ok: true,
              value: { sessionId, answer: { answers } },
            };
          } else {
            sendJSON(res, 400, { ok: false, error: "action must be answer or cancel" });
            return;
          }

          const receipt = await ctx.apiProxy.respond({
            type: "client-response",
            rpcId,
            result,
          });
          if (!receipt.accepted) {
            sendJSON(res, 409, { ok: false, error: `question response was rejected: ${receipt.reason}` });
            return;
          }
          pendingBySession.delete(sessionId);
          sendJSON(res, 200, { ok: true, accepted: true, action });
        } catch (error) {
          sendJSON(res, error?.statusCode ?? 400, {
            ok: false,
            error: error instanceof Error ? error.message : "question response failed",
          });
        }
      },
    }),
    "osmedeus: question response bridge",
  );
}

export function findBridgeForAgent(ctx, agent) {
	let session = agent?.session;
	for (let depth = 0; session && depth < 16; depth += 1) {
		const sessionId = String(session.id);
		const bridge = bridgeByRootSession.get(sessionId);
		if (bridge && SESSION_ID_PATTERN.test(sessionId)) {
			return { rootSessionId: sessionId, callerSessionId: String(agent.id), bridge };
		}
    const parent = session.header?.parentSession;
    session = parent ? ctx.sessions.get(parent) : undefined;
  }
  throw new Error(
    "No active Osmedeus authorization scope was found for this agent. Open the root Agent Pentest Session and click Sync Recon.",
  );
}

export async function postPentestBridge(ctx, agent, signal, route, payload) {
	const { rootSessionId, callerSessionId, bridge } = findBridgeForAgent(ctx, agent);
	const endpoint = new URL(route, osmedeusAPI);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Osmedeus-Pentest-Token": bridge.token,
    },
    body: JSON.stringify({
      ...payload,
      root_session_id: rootSessionId,
      caller_session_id: callerSessionId,
    }),
		signal,
  });
  const value = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
  if (!response.ok) {
    throw new Error(value?.message || `Osmedeus result bridge returned HTTP ${response.status}`);
  }
	return value;
}

async function postBridge(ctx, exec, route, payload) {
	return postPentestBridge(ctx, exec.agent, exec.signal, route, payload);
}

export function pentestBridgeContext(ctx, agent) {
	const resolved = findBridgeForAgent(ctx, agent);
	return {
		rootSessionId: resolved.rootSessionId,
		callerSessionId: resolved.callerSessionId,
		contextPath: resolved.bridge.contextPath,
		contextSha256: resolved.bridge.sha256,
		context: resolved.bridge.context,
	};
}

function registerResultTools(ctx) {
  ctx.tools.register(
    defineTool({
      name: "osmedeus_record_test",
      description:
        "Record the latest coverage status for a concrete test performed against an asset in the frozen Osmedeus scope. Call after an actual test attempt (including passed, blocked, or skipped), not while merely planning.",
      parameters: {
        asset_id: {
          type: "number",
          required: true,
          description: "Numeric asset id copied exactly from scope.authorized_assets.",
        },
        surface: {
          type: "string",
          required: true,
          description: "Specific URL, endpoint, port, service, or feature tested.",
        },
        category: {
          type: "string",
          required: true,
          description: "Test category, for example access-control, sqli, ssrf, tls, or authentication.",
        },
        status: {
          type: "string",
          required: true,
          enum: ["testing", "passed", "candidate", "blocked", "skipped"],
          description: "Latest outcome for this asset/surface/category tuple.",
        },
        summary: {
          type: "string",
          required: true,
          description: "Concise factual result and any limitation.",
        },
        skill_name: {
          type: "string",
          description: "Security Skill used for the test, if any.",
        },
        evidence_paths: {
          type: "array",
          items: { type: "string" },
          description: "Paths to saved evidence in the DSH workspace.",
        },
      },
      output: {
        schema: {
          type: "object",
          additionalProperties: true,
        },
        render: (_args, value) => [
          {
            type: "text",
            text: `Osmedeus coverage recorded: ${value?.data?.status || "saved"}`,
          },
        ],
      },
      execute: (args, exec) =>
        postBridge(ctx, exec, "/osm/api/agent-pentest/bridge/coverage", args),
    }),
  );

  ctx.tools.register(
    defineTool({
      name: "osmedeus_submit_finding",
      description:
        "Submit a reproducible vulnerability candidate from an actual authorized test to Osmedeus Vulnerabilities. It is stored as pending review; never use this for an unverified scanner lead or hypothesis.",
      parameters: {
        asset_id: {
          type: "number",
          required: true,
          description: "Numeric asset id copied exactly from scope.authorized_assets.",
        },
        title: { type: "string", required: true, description: "Specific vulnerability title." },
        description: {
          type: "string",
          required: true,
          description: "What is vulnerable and why the observed behavior demonstrates it.",
        },
        impact: { type: "string", required: true, description: "Concrete security impact." },
        poc: {
          type: "string",
          required: true,
          description: "Reproducible request, command, or ordered proof steps.",
        },
        severity: {
          type: "string",
          required: true,
          enum: ["critical", "high", "medium", "low", "info"],
        },
        confidence: {
          type: "string",
          description: "Agent's confidence rationale; Osmedeus still stores the candidate as Manual Review Required.",
        },
        endpoint: { type: "string", description: "Affected endpoint, port, or component." },
        request: { type: "string", description: "Sanitized raw request or command." },
        response: { type: "string", description: "Observed response or state proving the behavior." },
        skill_name: { type: "string", description: "Security Skill used to validate the candidate." },
        evidence_paths: {
          type: "array",
          items: { type: "string" },
          description: "Paths to saved evidence in the DSH workspace.",
        },
        tags: { type: "array", items: { type: "string" }, description: "Optional finding tags." },
      },
      output: {
        schema: { type: "object", additionalProperties: true },
        render: (_args, value) => [
          {
            type: "text",
            text: value?.deduplicated
              ? `Osmedeus finding already exists as #${value?.data?.id}`
              : `Osmedeus pending finding created as #${value?.data?.id}`,
          },
        ],
      },
      execute: (args, exec) =>
        postBridge(ctx, exec, "/osm/api/agent-pentest/bridge/findings", args),
    }),
  );
}

function contextSummary(context, contextPath, rootSessionId = context?.session?.dsh_session_id) {
  const scope = context?.scope ?? {};
  const recon = context?.recon ?? {};
	const executionMode = String(context?.session?.execution_mode || "direct");
	const modeGuidance = {
		orchestrated: "This root conversation is Primary Agent. Primary may execute with normal Harness tools and may call pentagi_delegate for focused named specialists; do not start a separate background PentAGI task.",
		direct: "This root conversation is the only Primary Agent. Work directly with normal Harness tools and do not delegate to subagents or workflows.",
		analysis: "This root conversation is Primary Agent in read-only mode. Inspect existing context only; do not run target tools, change files, delegate, or submit test/finding records.",
	}[executionMode] || "This root conversation is Primary Agent and may use its normal Harness tools directly.";
  return [
    "# Osmedeus Pentest Context",
    "",
    `Schema: ${context?.schema_version ?? "unknown"}`,
    `Workspace: ${context?.workspace?.name ?? "unknown"}`,
    `Authorized assets: ${scope.asset_count ?? 0}`,
    `Recon assets: ${recon.assets_total ?? 0}`,
    `Scanner findings: ${recon.vulnerabilities_total ?? 0}`,
    `Artifacts: ${recon.artifacts_total ?? 0}`,
    `Recent runs: ${recon.runs_total ?? 0}`,
		`Execution mode: ${executionMode}`,
    "",
		`Canonical context: ${contextPath}`,
		`Authorization root session: ${rootSessionId ?? "unknown"}`,
		`Mode policy: ${modeGuidance}`,
    "",
    "Load the `osmedeus-pentest` Skill before acting on this context.",
    "Only `scope.authorized_assets` defines executable target scope.",
    "",
  ].join("\n");
}

async function writeAgentContext(scopesRoot, sessionId, bridge) {
	const sessionRoot = join(scopesRoot, sessionId);
	const contextPath = join(sessionRoot, "context.json");
	const summaryPath = join(sessionRoot, "CONTEXT.md");
	const metadataPath = join(sessionRoot, "scope.json");
	const temporary = join(sessionRoot, `.context-${randomUUID()}.tmp`);

	await mkdir(sessionRoot, { recursive: true, mode: 0o700 });
	await writeFile(temporary, bridge.encoded, { encoding: "utf8", mode: 0o600 });
	await rename(temporary, contextPath);
	await writeFile(summaryPath, contextSummary(bridge.context, contextPath, bridge.rootSessionId), {
		encoding: "utf8",
		mode: 0o600,
	});
	await writeFile(
		metadataPath,
		`${JSON.stringify({
			schema_version: "osmedeus.pentest-scope/v1",
			session_id: sessionId,
			root_session_id: bridge.rootSessionId,
			context_path: contextPath,
			sha256: bridge.sha256,
		}, null, 2)}\n`,
		{ encoding: "utf8", mode: 0o600 },
	);
	return { contextPath, summaryPath };
}

async function materializeInheritedContext(ctx, scopesRoot, agent) {
	let resolved;
	try {
		resolved = findBridgeForAgent(ctx, agent);
	} catch {
		return;
	}
	if (resolved.callerSessionId === resolved.rootSessionId) return;
	await writeAgentContext(scopesRoot, resolved.callerSessionId, resolved.bridge);
}

/**
 * Materialize Osmedeus reconnaissance under DSH_HOME. Harness injects
 * DSH_SESSION_ID into every model shell call, so each conversation resolves
 * its own immutable scope without a shared workspace-level current file.
 */
export function apply(ctx) {
  const dshHome = resolve(process.env.DSH_HOME || join(homedir(), ".dsh"));
  const scopesRoot = join(dshHome, "osmedeus", "scopes");

	registerResultTools(ctx);
	registerQuestionBridge(ctx);

	// Materialize the root authorization context under every descendant's own
	// DSH_SESSION_ID before its next model step. Skills can therefore use the
	// same deterministic path in root, one-shot, and continuable sessions.
	ctx.on("agent/pre-step", async ({ agent }, next) => {
		await materializeInheritedContext(ctx, scopesRoot, agent);
		return next();
	});

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: "exact",
        path: CONTEXT_ROUTE,
        async handler(req, res) {
          if (req.method !== "POST") {
            res.setHeader("Allow", "POST");
            sendJSON(res, 405, { ok: false, error: "method not allowed" });
            return;
          }
          try {
            const payload = await readJSONBody(req);
            const sessionId = String(payload?.session_id ?? "").trim();
            if (!SESSION_ID_PATTERN.test(sessionId)) {
              sendJSON(res, 400, { ok: false, error: "invalid Osmedeus DSH session id" });
              return;
            }
            if (
              payload?.context?.session?.dsh_session_id !== sessionId ||
              payload?.context?.schema_version !== "osmedeus.pentest-context/v1"
            ) {
              sendJSON(res, 400, { ok: false, error: "context identity or schema mismatch" });
              return;
            }
            const bridgeToken = String(payload?.bridge_token ?? "").trim();
            if (bridgeToken.length < 32 || bridgeToken.length > 512) {
              sendJSON(res, 400, { ok: false, error: "invalid Osmedeus bridge token" });
              return;
            }

			const encoded = `${JSON.stringify(payload.context, null, 2)}\n`;
			const digest = createHash("sha256").update(encoded).digest("hex");

			// Capability stays in plugin memory. It is never written beside the
			// model-readable context and is replaced on every Sync Recon.
			const bridge = {
				token: bridgeToken,
				context: payload.context,
				encoded,
				sha256: digest,
				rootSessionId: sessionId,
			};
			const written = await writeAgentContext(scopesRoot, sessionId, bridge);
			bridge.contextPath = written.contextPath;
			bridgeByRootSession.set(sessionId, bridge);

			sendJSON(res, 201, {
				ok: true,
				session_id: sessionId,
				context_path: written.contextPath,
              schema_version: payload.context.schema_version,
              sha256: digest,
            });
          } catch (error) {
            sendJSON(res, error?.statusCode ?? 500, {
              ok: false,
              error: error instanceof Error ? error.message : "context bridge failed",
            });
          }
        },
		}),
		"osmedeus: pentest context bridge",
	);

	ctx.effect(
		() =>
			ctx.webServer.register({
				kind: "exact",
				path: CONTEXT_STATUS_ROUTE,
				handler(req, res) {
					if (req.method !== "GET") {
						res.setHeader("Allow", "GET");
						sendJSON(res, 405, { ok: false, error: "method not allowed" });
						return;
					}
					const requestURL = new URL(req.url || CONTEXT_STATUS_ROUTE, "http://127.0.0.1");
					const sessionId = String(requestURL.searchParams.get("session_id") ?? "").trim();
					if (!SESSION_ID_PATTERN.test(sessionId)) {
						sendJSON(res, 400, { ok: false, error: "invalid Osmedeus DSH session id" });
						return;
					}
					const bridge = bridgeByRootSession.get(sessionId);
					sendJSON(res, 200, {
						ok: true,
						active: bridge !== undefined,
						session_id: sessionId,
						context_path: bridge?.contextPath,
						sha256: bridge?.sha256,
					});
				},
			}),
		"osmedeus: pentest context status",
	);
}
