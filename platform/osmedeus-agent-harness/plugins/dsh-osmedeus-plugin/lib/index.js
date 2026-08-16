import { createHash, randomUUID } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { defineTool } from "@deepseek-ai/dsh-tools";

const CONTEXT_ROUTE = "/osmedeus/context";
const MAX_CONTEXT_BYTES = 16 * 1024 * 1024;
const SESSION_ID_PATTERN = /^session-osm-[a-f0-9]{32}$/;
const bridgeByRootSession = new Map();
const osmedeusAPI = new URL(process.env.OSM_API_URL || "http://127.0.0.1:8002");

export const inject = ["webServer", "tools", "sessions"];

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

function findBridgeForAgent(ctx, exec) {
  let session = exec.agent?.session;
  for (let depth = 0; session && depth < 16; depth += 1) {
    const sessionId = String(session.id);
    const bridge = bridgeByRootSession.get(sessionId);
    if (bridge && SESSION_ID_PATTERN.test(sessionId)) {
      return { rootSessionId: sessionId, callerSessionId: String(exec.agent.id), bridge };
    }
    const parent = session.header?.parentSession;
    session = parent ? ctx.sessions.get(parent) : undefined;
  }
  throw new Error(
    "No active Osmedeus authorization scope was found for this agent. Open the root Agent Pentest Session and click Sync Recon.",
  );
}

async function postBridge(ctx, exec, route, payload) {
  const { rootSessionId, callerSessionId, bridge } = findBridgeForAgent(ctx, exec);
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
    signal: exec.signal,
  });
  const value = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
  if (!response.ok) {
    throw new Error(value?.message || `Osmedeus result bridge returned HTTP ${response.status}`);
  }
  return value;
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

function contextSummary(context, contextPath) {
  const scope = context?.scope ?? {};
  const recon = context?.recon ?? {};
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
    "",
    `Canonical context: ${contextPath}`,
    "",
    "Load the `osmedeus-pentest` Skill before acting on this context.",
    "Only `scope.authorized_assets` defines executable target scope.",
    "",
  ].join("\n");
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

            const sessionRoot = join(scopesRoot, sessionId);
            const contextPath = join(sessionRoot, "context.json");
            const summaryPath = join(sessionRoot, "CONTEXT.md");
            const encoded = `${JSON.stringify(payload.context, null, 2)}\n`;
            const digest = createHash("sha256").update(encoded).digest("hex");
            const temporary = join(sessionRoot, `.context-${randomUUID()}.tmp`);

            await mkdir(sessionRoot, { recursive: true, mode: 0o700 });
            await writeFile(temporary, encoded, { encoding: "utf8", mode: 0o600 });
            await rename(temporary, contextPath);
            await writeFile(summaryPath, contextSummary(payload.context, contextPath), {
              encoding: "utf8",
              mode: 0o600,
            });

            // Capability stays in plugin memory. It is never written beside the
            // model-readable context and is replaced on every Sync Recon.
            bridgeByRootSession.set(sessionId, { token: bridgeToken });

            sendJSON(res, 201, {
              ok: true,
              session_id: sessionId,
              context_path: contextPath,
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
}
