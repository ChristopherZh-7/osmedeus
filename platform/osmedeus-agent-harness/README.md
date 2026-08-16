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
  deep-links Osmedeus records to native DSH Sessions; later DSH-facing Skills,
  scoped tools, and finding submission capabilities belong here.
- Telemetry is disabled and the filesystem permission mode is `read-only` by
  default. The future pentest plugin will expose explicitly scoped tools.
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
| `OSM_DSH_WORKSPACE` | `$DSH_HOME/runtime-workspace` | Safe process working directory |
| `OSM_DSH_PATCH` | empty | Optional future Osmedeus profile overlay |
| `DSH_PERMISSION_MODE` | `read-only` | Harness filesystem permission preset |

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
5. Lets the browser plugin open that exact native Session through the
   `osmSession` deep link, so the original DSH Chat/Trajectory surface is used.

No API credential or target-controlled path is sent to browser plugin code.
The frozen asset snapshot is not submitted as an automatic model prompt;
future scoped MCP/tools read it through the Osmedeus session mapping, avoiding
an unapproved model run at session creation time.

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
