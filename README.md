# Golish Pentest Platform

Golish is an auditable workflow engine and integrated platform for security
automation, asset management, distributed scanning, and agent-assisted
penetration testing.

[Documentation](docs/) · [Security policy](SECURITY.md) · [Releases](https://github.com/ChristopherZh-7/golish-pentest-platform/releases)

## What is Golish?

[Golish](https://github.com/ChristopherZh-7/golish-pentest-platform) is a security focused declarative orchestration engine that simplifies complex workflow automation into auditable YAML definitions, complete with encrypted data handling, secure credential management, and sandboxed execution.

Built for both beginners and experts, it delivers powerful, composable automation without sacrificing the integrity and safety of your infrastructure.

## Key Features

- **Declarative YAML Workflows** - Define pipelines with hooks, decision routing, module exclusion, and conditional branching across multiple runners (host, Docker, SSH)
- **Distributed Execution** - Redis-based master-worker pattern with queue system, webhook triggers, and file sync across workers
- **Rich Function Library** - 80+ utility functions including nmap integration, tmux sessions, SSH execution, TypeScript/Python scripting, SARIF parsing, and CDN/WAF classification
- **Event-Driven Scheduling** - Cron, file-watch, and event triggers with filtering, deduplication, and delayed task queues
- **Agentic LLM Steps** - Tool-calling agent loops with sub-agent orchestration, memory management, and structured output; plus ACP subprocess agents (Claude Code, Codex, OpenCode, Gemini)
- **Cloud Infrastructure** - Provision and run scans across DigitalOcean, AWS, GCP, Linode, and Azure with cost controls and automatic cleanup
- **Rich CLI Interface** - Interactive database queries, bulk function evaluation, workflow linting, progress bars, and comprehensive usage examples
- **REST API & Web UI** - Full API server with webhook triggers, database queries, and embedded dashboard for visualization

See [Documentation Page](https://github.com/ChristopherZh-7/golish-pentest-platform/tree/main/docs) for more details.

## Installation

```bash
curl -fsSL https://raw.githubusercontent.com/ChristopherZh-7/golish-registry/main/install.sh | bash
```

### One-command deployment

From a source checkout, Docker Compose can build, initialize, and start the
complete platform with generated credentials. Docker Compose is the only
required runtime; on macOS, an installed Colima is started automatically when
needed:

```bash
make deploy
```

This starts PostgreSQL, Redis, the Golish server and workers, and the
version-locked DeepSeek Harness with its plugins, bundled Skills, and 7,600+
CyberStrike corpus. Only the Golish server port (`8002` by default) is
published. DSH remains on the private Docker network and is used through the
native Agent Pentest UI; its separate web port is not exposed.

```bash
make deploy-status       # service status
make deploy-credentials  # show the generated admin login
make deploy-logs         # follow logs
make deploy-down         # stop while retaining data
```

Generated secrets and runtime settings live in the gitignored
`.golish-deploy/` directory. Set the DeepSeek key there after the first run,
then rerun `make deploy`. If image downloads need the local proxy, use
`make deploy DSH_PROXY=http://127.0.0.1:6152`.

For non-container development, `make install` still installs the Go binary,
DSH, plugins, and bundled Skills locally; `make dsh-start` starts its loopback
development service. Use `make install-core` when only the Go binary is needed.

### [npm](https://www.npmjs.com/package/@christopherzh-7/golish)

```bash
npm install -g @christopherzh-7/golish
```

Ships prebuilt binaries for linux and macOS on x64/arm64.

See the local [documentation](docs/) for setup and operating details.


## Quick Start

```bash
# Run a module workflow
golish run -m recon -t example.com

# Run a flow workflow
golish run -f general -t example.com

# Multiple targets with concurrency
golish run -m recon -T targets.txt -c 5

# Dry-run mode (preview)
golish run -f general -t example.com --dry-run

# Start API server
golish serve

# List available workflows
golish workflow list

# Query discovered assets
golish assets -w example.com                          # List assets for workspace
golish assets --stats                                 # Show unique technologies, sources, types
golish assets --source httpx --type web --json        # Filter and output as JSON

# Query vulnerabilities, runs, and steps
golish query vulns --severity high --workspace example.com
golish query runs --status running
golish query steps --run <run-uuid>

# Query database tables
golish db list --table runs
golish db list --table event_logs --search "nuclei"

# Evaluate utility functions
golish func eval 'log_info("hello")'
golish func eval -e 'http_get("https://example.com")' -T targets.txt -c 10

# Platform variables available in eval
golish func eval 'log_info("OS: " + PlatformOS + ", Arch: " + PlatformArch)'

# Install from preset repositories
golish install base --preset
golish install base --preset --keep-setting   # preserve existing golish-settings.yaml
golish install workflow --preset

# Exclude modules from flow execution
golish run -f general -t example.com -x portscan
golish run -f general -t example.com -X vuln    # Fuzzy exclude by substring

# Worker queue system
golish worker queue new -f general -t example.com   # Queue for later
golish worker queue run --concurrency 5              # Process queue

# Worker management
golish worker status                          # Show workers
golish worker eval -e 'ssh_exec("host", "whoami")'  # Eval with distributed hooks

# Run an ACP agent interactively
golish agent "analyze this codebase"
golish agent --agent codex "explain main.go"
golish agent --list

# Cloud infrastructure management
golish cloud create --instances 3                    # Provision cloud machines
golish cloud setup 1.2.3.4 5.6.7.8                  # Setup existing machines
golish cloud list                                    # List active infrastructure
golish cloud run -f general -t example.com --instances 3

# Show all usage examples
golish --usage-example
```

## Docker

```bash
# Show help
docker run --rm ghcr.io/christopherzh-7/golish-pentest-platform:latest --help

# Run a scan
docker run --rm -v $(pwd)/output:/root/workspaces-golish \
    ghcr.io/christopherzh-7/golish-pentest-platform:latest run -f general -t example.com
```

For more CLI usage and examples, see [docs](docs/).

## High-Level Architecture

```plaintext
┌───────────────────────────────────────────────────────────────────────────┐
│                   Golish Orchestration Engine                           │
├───────────────────────────────────────────────────────────────────────────┤
│  ENTRY POINTS                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐                │
│  │   CLI    │  │ REST API │  │Scheduler │  │ Distributed │                │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └─────┬───────┘                │
│       └─────────────┴─────────────┴──────────────┘                        │
│                              │                                            │
│                              ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ CONFIG ──▶ PARSER ──▶ EXECUTOR ──▶ STEP DISPATCHER ──▶ RUNNER       │  │
│  │                          │                                          │  │
│  │  Step Executors: bash | function | parallel | foreach | remote-bash │  │
│  │                  http | llm | agent | agent-acp | SARIF/SAST       │  │
│  │  Hooks: pre_scan_steps → [main steps] → post_scan_steps             │  │
│  │                          │                                          │  │
│  │  Runners: HostRunner | DockerRunner | SSHRunner                     │  │
│  │  Queue: DB + Redis polling → dedup → concurrent execution           │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────┘
```

For more information about the architecture, see [CLAUDE.md](CLAUDE.md).

## Roadmap and Status

The high-level ambitious plan for the project, in order:

|  #  | Step                                                                        |  Status |
| :-: | --------------------------------------------------------------------------- |  :----: |
|  1  | Golish Engine reforged with a next-generation architecture                |    ✅   |
|  2  | Flexible workflows and step types                                           |    ✅   |
|  3  | Event-driven architectural model and the different trigger event categories |    ✅   |
|  4  | Beautiful UI for visualize results and workflow diagram                     |    ✅   |
|  5  | Rewriting the workflow to adapt to new architecture and syntax              |    ✅   |
|  6  | Testing more utility functions like notifications                           |    ✅   |
|  7  | SAST integration with SARIF parsing (Semgrep, Trivy, etc.)                  |    ✅   |
|  8  | Cloud integration, which supports running the scan on the cloud provider.   |    ✅   |
|  9  | Generate diff reports showing new/removed/unchanged assets between runs.    |    ❌   |
|  10 | Adding step type from cloud provider that can be run via serverless         |    ❌   |
|  N  | Fancy features (to be discussed later)                                      |    ❌   |
## Documentation

| Topic                | Link                                                                                                     |
|----------------------|----------------------------------------------------------------------------------------------------------|
| API reference        | [docs/api](docs/api/) |
| Cloud operations     | [docs/cloud](docs/cloud/) |
| Deployment           | [build/DEPLOYMENT.md](build/DEPLOYMENT.md) |
| Development          | [HACKING.md](HACKING.md) |
| Security model       | [SECURITY.md](SECURITY.md) |

## Disclaimer

**Golish** is designed to execute arbitrary code and commands from user supplied input via CLI, API, and workflow definitions. This flexibility is intentional and central to how the engine operates.

[SECURITY.md](SECURITY.md) explains the trust boundary for intentional code
execution and how to report a vulnerability.

**Think twice before you:**
- Run workflows downloaded from untrusted sources
- Execute commands or scans against targets you don't own or have permission to test
- Use workflows without reviewing their contents first

You are responsible for what you run. Always review workflow YAML files before execution, especially those obtained from third parties.

## License

Golish is released under the MIT license. The required upstream copyright and
permission notice are retained in [LICENSE](LICENSE).
