import { createHash, randomUUID } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const CONTEXT_ROUTE = "/osmedeus/context";
const MAX_CONTEXT_BYTES = 16 * 1024 * 1024;
const SESSION_ID_PATTERN = /^session-osm-[a-f0-9]{32}$/;

export const inject = ["webServer"];

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
