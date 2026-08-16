# Osmedeus Agent Harness Sidecar

This directory integrates the official DeepSeek Harness as a versioned sidecar.
It is an adapter owned by Osmedeus, not a fork or vendored copy of the Harness
source code.

## Runtime contract

- `@deepseek-ai/dsh` is pinned to an exact, tested version in `package.json` and
  `package-lock.json`.
- Harness state is stored below `DSH_HOME`; the default is
  `~/osmedeus-base/agent-harness/dsh-home`.
- The Harness process starts in a dedicated runtime workspace, never in the
  Osmedeus source tree or a target-controlled repository.
- `plugins/dsh-osmedeus-plugin` is the upgrade-safe DSH profile boundary. It
  deep-links native Sessions and materializes the matching reconnaissance
  envelope below `DSH_HOME`.
- `plugins/dsh-pentagi-orchestrator` adds the 15-role PentAGI-style task state
  machine through public DSH plugin seams. It does not patch Harness packages.
- `skills/` is copied into DSH's official `$DSH_HOME/skills` discovery root;
  no Harness package is patched.
- Telemetry is disabled. The default `workspace-write` permission mode keeps
  DSH approval prompts while allowing evidence to be saved in its workspace.
- The Web host listens on `127.0.0.1:3080` by default.

## Local development

```bash
make dsh-install
make dsh-start
make dsh-check
```

If registry access is slow, apply a proxy only to that command (without
changing global npm settings):

```bash
make dsh-install DSH_PROXY=http://127.0.0.1:6152
```

Useful environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `DSH_HOME` | `~/osmedeus-base/agent-harness/dsh-home` | Persistent Harness state |
| `OSM_DSH_HOST` | `127.0.0.1` | Web bind address |
| `OSM_DSH_PORT` | `3080` | Web port |
| `OSM_DSH_TRUSTED_HOST` | empty | Comma-separated extra API authorities (for example `agent-harness:3080`) |
| `OSM_DSH_URL` | derived from host and port | URL used by health checks |
| `OSM_API_URL` | `http://127.0.0.1:8002` | Fixed Osmedeus API origin used by the server-side result bridge |
| `OSM_DSH_WORKSPACE` | `$DSH_HOME/runtime-workspace` | Safe process working directory |
| `OSM_DSH_PATCH` | empty | Optional future Osmedeus profile overlay |
| `DSH_PERMISSION_MODE` | `workspace-write` | Harness filesystem permission preset |

## Osmedeus Workspace adapter seam

Osmedeus remains the source of truth for authorization scope. The Agent
Pentest page reads Workspaces and Assets from the existing Osmedeus API and
creates sessions through `POST /osm/api/agent-pentest/sessions`.

The server-side adapter then:

1. Freezes the explicitly selected asset IDs and their minimal metadata in
   `agent_pentest_sessions` for auditability.
2. Materializes one platform-controlled DSH directory per Osmedeus Workspace
   below the Harness runtime workspace.
3. Reuses or creates a native DSH Workspace with the Osmedeus display name.
4. Creates one native DSH Session per Agent Pentest session and stores the
   bidirectional IDs in Osmedeus.
5. Proxies the exact Session's Chat, Trajectory, and Subagent domains through
   authenticated Osmedeus endpoints so the dashboard can render a native UI.
6. Resolves every child-agent operation from the authorized root Session; the
   browser never supplies a trusted DSH parent identity.
7. Publishes a bounded, session-specific reconnaissance document to
   `$DSH_HOME/osmedeus/scopes/$DSH_SESSION_ID/context.json` through the plugin.
8. Gives the plugin a rotating per-session capability held only in memory. The
   native `osmedeus_record_test` and `osmedeus_submit_finding` tools use it to
   write coverage and pending findings back to assets in the frozen scope.
9. Materializes the immutable root context under each child Session ID before
   its model step, so every specialist Skill resolves the same authorization.
10. Persists generated tasks, revised subtasks, role runs, selected memory, and
    final reports in Osmedeus while DSH keeps the full per-role transcript.

The orchestrator exposes four root tools:

- `osmedeus_start_pentest_task`
- `osmedeus_get_pentest_task`
- `osmedeus_resume_pentest_task`
- `osmedeus_cancel_pentest_task`

Inside a managed role, `pentagi_delegate`, `pentagi_memory_search`, and
`pentagi_memory_write` implement specialist delegation and cross-role memory.

No API credential or target-controlled path is sent to browser plugin code.
The frozen asset snapshot is not submitted as an automatic model prompt, so
session creation never triggers an unapproved model run. The
`osmedeus-pentest` Skill loads the correct context using Harness-provided
`DSH_SESSION_ID` when the operator starts the conversation.

## Upgrade policy

DeepSeek Harness is currently a developer preview. Upgrades are explicit so a
new release cannot silently break the platform:

```bash
make dsh-upgrade DSH_VERSION=0.1.0-rc.7
# Optional: add DSH_PROXY=http://127.0.0.1:6152
make dsh-start
make dsh-check
```

The upgrade command updates the exact dependency and lockfile, then verifies
that the package manifest, installed package, and `dsh --version` agree. Commit
the resulting `package.json` and `package-lock.json` only after the connection
check and platform integration tests pass.
