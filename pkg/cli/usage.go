package cli

import (
	"github.com/ChristopherZh-7/golish-pentest-platform/v5/internal/core"
	"github.com/ChristopherZh-7/golish-pentest-platform/v5/internal/terminal"
)

// UsageRoot returns the Long description for the root command
func UsageRoot() string {
	return terminal.BoldCyan("◆ Description") + `
  Golish is a powerful workflow engine for executing automated
  reconnaissance and security assessment workflows.

  It supports both module (single execution units) and flow (multi-module
  orchestration) workflows with parallel and sequential execution patterns.

` + terminal.BoldCyan("▶ Key Features") + `
  • Execute YAML-defined security workflows
  • Support for parallel and sequential execution
  • Distributed scanning with master/worker architecture
  • Template variables and utility functions

` + terminal.BoldCyan("▷ Quick Start") + `
  ` + terminal.Green("# Run a module workflow") + `
  golish run ` + terminal.Yellow("-m") + ` simple-module ` + terminal.Yellow("-t") + ` example.com

  ` + terminal.Green("# Run a flow workflow") + `
  golish run ` + terminal.Yellow("-f") + ` recon-workflow ` + terminal.Yellow("-t") + ` example.com

  ` + terminal.Green("# Evaluate a utility function") + `
  golish func e 'log_info("Hello {{target}}")' ` + terminal.Yellow("-t") + ` example.com

  ` + terminal.Green("# List available workflows") + `
  golish workflow list

  ` + terminal.Green("# Show all usage examples") + `
  golish ` + terminal.Yellow("--usage-example") + `

` + docsFooter()
}

// UsageRun returns the Long description for the run command
func UsageRun() string {
	return terminal.BoldCyan("◆ Description") + `
  Execute a workflow against one or more targets.

` + terminal.BoldCyan("▷ Examples") + `
  ` + terminal.Green("# Run against a single target") + `
  golish run ` + terminal.Yellow("-f") + ` recon-workflow ` + terminal.Yellow("-t") + ` example.com

  ` + terminal.Green("# Run against multiple targets") + `
  golish run ` + terminal.Yellow("-m") + ` simple-module ` + terminal.Yellow("-t") + ` target1.com ` + terminal.Yellow("-t") + ` target2.com

  ` + terminal.Green("# Run with stdin input with concurrency") + `
  cat list-of-urls.txt | golish run ` + terminal.Yellow("-m") + ` simple-module ` + terminal.Yellow("--concurrency") + ` 10

  ` + terminal.Green("# Combine multiple input methods") + `
  echo "extra.com" | golish run ` + terminal.Yellow("-m") + ` simple-module ` + terminal.Yellow("-t") + ` main.com ` + terminal.Yellow("-T") + ` more-targets.txt

  ` + terminal.Green("# Run with custom parameters") + `
  golish run ` + terminal.Yellow("-m") + ` simple-module ` + terminal.Yellow("-t") + ` example.com ` + terminal.Yellow("--params") + ` 'threads=20'

  ` + terminal.Green("# Run with custom base folder") + `
  golish run ` + terminal.Yellow("--base-folder") + ` /opt/golish-base ` + terminal.Yellow("-f") + ` recon-workflow ` + terminal.Yellow("-t") + ` example.com

  ` + terminal.Green("# Run with timeout (cancel if exceeds)") + `
  golish run ` + terminal.Yellow("-m") + ` recon ` + terminal.Yellow("-t") + ` example.com ` + terminal.Yellow("--timeout") + ` 2h

  ` + terminal.Green("# Repeat run every hour continuously") + `
  golish run ` + terminal.Yellow("-m") + ` recon ` + terminal.Yellow("-t") + ` example.com ` + terminal.Yellow("--repeat") + ` ` + terminal.Yellow("--repeat-wait-time") + ` 1h

  ` + terminal.Green("# Run multiple modules in sequence") + `
  golish run ` + terminal.Yellow("-m") + ` subdomain ` + terminal.Yellow("-m") + ` portscan ` + terminal.Yellow("-m") + ` vulnscan ` + terminal.Yellow("-t") + ` example.com

  ` + terminal.Green("# Combine timeout with repeat mode") + `
  golish run ` + terminal.Yellow("-m") + ` recon ` + terminal.Yellow("-t") + ` example.com ` + terminal.Yellow("--timeout") + ` 3h ` + terminal.Yellow("--repeat") + ` ` + terminal.Yellow("--repeat-wait-time") + ` 30m

  ` + terminal.Green("# Dry-run mode (preview without executing)") + `
  golish run ` + terminal.Yellow("-m") + ` recon ` + terminal.Yellow("-t") + ` example.com ` + terminal.Yellow("--dry-run") + `

  ` + terminal.Green("# Run module from stdin (pipe YAML)") + `
  cat module.yaml | golish run ` + terminal.Yellow("--std-module") + ` ` + terminal.Yellow("-t") + ` example.com

  ` + terminal.Green("# Run module from URL") + `
  golish run ` + terminal.Yellow("--module-url") + ` https://example.com/module.yaml ` + terminal.Yellow("-t") + ` example.com

  ` + terminal.Green("# Run module from GitHub (public)") + `
  golish run ` + terminal.Yellow("--module-url") + ` https://raw.githubusercontent.com/user/repo/main/module.yaml ` + terminal.Yellow("-t") + ` example.com

  ` + terminal.Green("# Run module from private GitHub repo (requires GH_TOKEN or GITHUB_API_KEY)") + `
  golish run ` + terminal.Yellow("--module-url") + ` https://github.com/user/private-repo/blob/main/module.yaml ` + terminal.Yellow("-t") + ` example.com

  ` + terminal.Green("# Load parameters from YAML/JSON file") + `
  golish run ` + terminal.Yellow("-m") + ` recon ` + terminal.Yellow("-t") + ` example.com ` + terminal.Yellow("--params-file") + ` params.yaml

  ` + terminal.Green("# Custom workspace path") + `
  golish run ` + terminal.Yellow("-m") + ` recon ` + terminal.Yellow("-t") + ` example.com ` + terminal.Yellow("--workspace") + ` /custom/workspace

  ` + terminal.Green("# Skip heuristics checks") + `
  golish run ` + terminal.Yellow("-m") + ` recon ` + terminal.Yellow("-t") + ` example.com ` + terminal.Yellow("--heuristics-check") + ` none

  ` + terminal.Green("# Concurrent targets from file") + `
  golish run ` + terminal.Yellow("-m") + ` recon ` + terminal.Yellow("-T") + ` targets.txt ` + terminal.Yellow("--concurrency") + ` 5

  ` + terminal.Green("# View chunk info for target file") + `
  golish run ` + terminal.Yellow("-m") + ` recon ` + terminal.Yellow("-T") + ` targets.txt ` + terminal.Yellow("--chunk-size") + ` 100

  ` + terminal.Green("# Run specific chunk (0-indexed)") + `
  golish run ` + terminal.Yellow("-m") + ` recon ` + terminal.Yellow("-T") + ` targets.txt ` + terminal.Yellow("--chunk-size") + ` 100 ` + terminal.Yellow("--chunk-part") + ` 2

  ` + terminal.Green("# Split into 4 equal chunks and run chunk 0") + `
  golish run ` + terminal.Yellow("-m") + ` recon ` + terminal.Yellow("-T") + ` targets.txt ` + terminal.Yellow("--chunk-count") + ` 4 ` + terminal.Yellow("--chunk-part") + ` 0

  ` + terminal.Green("# Manual target splitting across machines") + `
  golish run ` + terminal.Yellow("-m") + ` recon ` + terminal.Yellow("-T") + ` targets.txt ` + terminal.Yellow("--chunk-size") + ` 250 ` + terminal.Yellow("--chunk-part") + ` 0  ` + terminal.Gray("# Machine 1") + `
  golish run ` + terminal.Yellow("-m") + ` recon ` + terminal.Yellow("-T") + ` targets.txt ` + terminal.Yellow("--chunk-size") + ` 250 ` + terminal.Yellow("--chunk-part") + ` 1  ` + terminal.Gray("# Machine 2") + `

  ` + terminal.Green("# Queue a run for later processing") + `
  golish run ` + terminal.Yellow("--queue") + ` ` + terminal.Yellow("-m") + ` recon ` + terminal.Yellow("-t") + ` example.com

  ` + terminal.Green("# Queue with file target") + `
  golish run ` + terminal.Yellow("--queue") + ` ` + terminal.Yellow("-m") + ` recon ` + terminal.Yellow("-T") + ` targets.txt

  ` + terminal.Green("# Process queued tasks (alias for 'golish worker queue run')") + `
  golish run ` + terminal.Yellow("--queue-run") + `

  ` + terminal.Green("# Process queued tasks with concurrency") + `
  golish run ` + terminal.Yellow("--queue-run") + ` ` + terminal.Yellow("--concurrency") + ` 3

  ` + terminal.Green("# Register a webhook trigger (no execution)") + `
  golish run ` + terminal.Yellow("--as-webhook") + ` ` + terminal.Yellow("-m") + ` recon ` + terminal.Yellow("-t") + ` example.com

  ` + terminal.Green("# Register a webhook with auth key") + `
  golish run ` + terminal.Yellow("--as-webhook") + ` ` + terminal.Yellow("--webhook-auth-key") + ` mykey ` + terminal.Yellow("-f") + ` general ` + terminal.Yellow("-t") + ` example.com

  ` + terminal.Green("# Create a cron schedule (daily at 2am)") + `
  golish run ` + terminal.Yellow("--as-cron") + ` '0 2 * * *' ` + terminal.Yellow("-m") + ` recon ` + terminal.Yellow("-t") + ` example.com

  ` + terminal.Green("# Create a cron schedule (every 6 hours) for a flow") + `
  golish run ` + terminal.Yellow("--as-cron") + ` '0 */6 * * *' ` + terminal.Yellow("-f") + ` general ` + terminal.Yellow("-t") + ` example.com

  ` + terminal.Green("# Create cron schedules for multiple targets") + `
  golish run ` + terminal.Yellow("--as-cron") + ` '0 0 * * 1' ` + terminal.Yellow("-m") + ` recon ` + terminal.Yellow("-T") + ` targets.txt

` + docsFooter()
}

// UsageServe returns the Long description for the serve command
func UsageServe() string {
	return terminal.BoldCyan("◆ Description") + `
  Start the Golish web server that provides REST API endpoints.

` + terminal.BoldCyan("▶ Features") + `
  • REST API for managing runs
  • Workflow listing and management
  • Real-time run progress via WebSocket
  • Settings management

  Use ` + terminal.Yellow("--master") + ` to run as a distributed master node that coordinates
  workers connected via Redis.

` + terminal.BoldCyan("▷ Examples") + `
  ` + terminal.Green("# Start server with default settings") + `
  golish serve

  ` + terminal.Green("# Start server on custom port") + `
  golish serve ` + terminal.Yellow("--port") + ` 8080

  ` + terminal.Green("# Start server without authentication (development only)") + `
  golish serve ` + terminal.Yellow("-A") + `

  ` + terminal.Green("# Start server on specific host without auth") + `
  golish serve ` + terminal.Yellow("--host") + ` 127.0.0.1 ` + terminal.Yellow("--port") + ` 8811 ` + terminal.Yellow("-A") + `

  ` + terminal.Green("# Start as distributed master node") + `
  golish serve ` + terminal.Yellow("--master") + `

  ` + terminal.Green("# Start server without queue polling") + `
  golish serve ` + terminal.Yellow("--no-queue-polling") + `

` + docsFooter()
}

// UsageWorkflow returns the Long description for the workflow command
func UsageWorkflow() string {
	return terminal.BoldCyan("◆ Description") + `
  Commands for listing, viewing, and validating workflows.

` + terminal.BoldCyan("▶ Subcommands") + `
  • ` + terminal.Yellow("list") + `      - List available workflows (alias: ls)
  • ` + terminal.Yellow("show") + `      - Show workflow details (alias: view)
  • ` + terminal.Yellow("validate") + `  - Validate a workflow (alias: val)

` + terminal.BoldCyan("▶ Workflow Preferences") + `
  Workflows can define execution preferences in YAML that act as defaults.
  CLI flags always take precedence over workflow preferences.

  ` + terminal.Yellow("preferences:") + `
    ` + terminal.Gray("disable_notifications: false") + `   # --disable-notification
    ` + terminal.Gray("disable_logging: true") + `          # --disable-logging
    ` + terminal.Gray("heuristics_check: 'basic'") + `      # --heuristics-check
    ` + terminal.Gray("ci_output_format: true") + `         # --ci-output-format
    ` + terminal.Gray("silent: true") + `                   # --silent
    ` + terminal.Gray("repeat: true") + `                   # --repeat
    ` + terminal.Gray("repeat_wait_time: '60s'") + `        # --repeat-wait-time

` + docsFooter()
}

// UsageFunction returns the Long description for the function command
func UsageFunction() string {
	return terminal.BoldCyan("◆ Description") + `
  Execute and test utility functions available in workflows.

` + terminal.BoldCyan("▶ Subcommands") + `
  • ` + terminal.Yellow("list") + `       - List all available functions
  • ` + terminal.Yellow("eval (e)") + `   - Evaluate scripts with template rendering

` + terminal.BoldCyan("▷ Examples") + `
  ` + terminal.Green("# List all available functions") + `
  golish func list

  ` + terminal.Green("# Evaluate a simple function") + `
  golish func eval 'trim("  hello  ")'

  ` + terminal.Green("# Short alias for eval") + `
  golish func e 'log_info("Hello World")'

  ` + terminal.Green("# Use with target variable") + `
  golish func e 'file_exists("{{target}}")' ` + terminal.Yellow("-t") + ` /tmp/test.txt

  ` + terminal.Green("# Print markdown file with syntax highlighting") + `
  golish func e 'print_markdown_from_file("README.md")'

  ` + terminal.Green("# Multi-line script with variable") + `
  golish func e 'var x = trim("  test  "); log_info(x); x'

  ` + terminal.Green("# Make HTTP request") + `
  golish func e 'http_request("https://api.example.com", "GET", {}, "")'

  ` + terminal.Green("# With custom params") + `
  golish func e 'log_info("{{host}}:{{port}}")' ` + terminal.Yellow("--params") + ` 'host=localhost' ` + terminal.Yellow("--params") + ` 'port=8080'

  ` + terminal.Green("# Use -f flag for shell path autocompletion on file arguments") + `
  golish func e ` + terminal.Yellow("-f") + ` trim "  hello world  "
  golish func e ` + terminal.Yellow("-f") + ` file_exists /tmp
  golish func e ` + terminal.Yellow("-t") + ` example.com ` + terminal.Yellow("-f") + ` log_info "Processing {{target}}"

  ` + terminal.Green("# Query database with SQL") + `
  golish func e 'db_select("SELECT severity, COUNT(*) FROM vulnerabilities GROUP BY severity", "markdown")'

  ` + terminal.Green("# Query filtered assets from database") + `
  golish func e 'db_select_assets_filtered("example.com", 200, "subdomain", "jsonl")'

  ` + terminal.Green("# Read script from stdin") + `
  echo 'log_info("hello")' | golish func e ` + terminal.Yellow("--stdin") + `

  ` + terminal.Green("# Alternative stdin syntax") + `
  echo 'trim("  test  ")' | golish func e -

` + docsFooter()
}

// UsageFunctionEval returns the Long description for the function eval command
func UsageFunctionEval() string {
	return terminal.BoldCyan("◆ Description") + `
  Evaluate a script with template rendering and function execution.

` + terminal.BoldCyan("▶ Processing Phases") + `
  1. Template variables ({{target}}, {{custom}}) are rendered
  2. The result is executed as JavaScript with access to utility functions

` + terminal.BoldCyan("▷ Examples") + `
  ` + terminal.Green("# Print markdown file with syntax highlighting") + `
  golish func e 'print_markdown_from_file("README.md")'

  ` + terminal.Green("# Log a message with INFO prefix") + `
  golish func e 'log_info("Scan completed for {{target}}")' ` + terminal.Yellow("-t") + ` example.com

  ` + terminal.Green("# Save content to file") + `
  golish func e 'save_content(render_markdown_from_file("README.md"), "/tmp/output.txt")'

  ` + terminal.Green("# Use with variable") + `
  golish func e 'var content = "sample"; save_content(content, "/tmp/output.txt")'


  ` + terminal.Green("# Sort a file using Unix sort") + `
  golish func e 'sort_unix("/tmp/input.txt", "/tmp/sorted.txt")'

  ` + terminal.Green("# Make HTTP request") + `
  golish func e 'http_request("https://api.example.com", "GET", {}, "")'

  ` + terminal.Green("# With custom params") + `
  golish func e 'log_info("{{host}}:{{port}}")' ` + terminal.Yellow("--params") + ` 'host=localhost' ` + terminal.Yellow("--params") + ` 'port=8080'

  ` + terminal.Green("# Use -f flag for shell path autocompletion on file arguments") + `
  golish func e ` + terminal.Yellow("-f") + ` trim "  hello world  "
  golish func e ` + terminal.Yellow("-f") + ` file_exists /tmp
  golish func e ` + terminal.Yellow("-t") + ` example.com ` + terminal.Yellow("-f") + ` log_info "Processing {{target}}"

  ` + terminal.Green("# Query database - get vulnerability counts by severity") + `
  golish func e 'db_select("SELECT severity, COUNT(*) as count FROM vulnerabilities GROUP BY severity", "markdown")'

  ` + terminal.Green("# Query database - get filtered assets as JSONL") + `
  golish func e 'db_select_assets_filtered("example.com", 200, "subdomain", "jsonl")'

  ` + terminal.Green("# Query database - get all vulnerabilities for a workspace") + `
  golish func e 'db_select_vulnerabilities("example.com", "markdown")'

  ` + terminal.Green("# Read script from stdin") + `
  echo 'print_markdown_from_file("README.md")' | golish func e --stdin

  ` + terminal.Green("# Alternative stdin syntax") + `
  echo 'log_info("hello")' | golish func e -

` + terminal.BoldCyan("▷ Bulk Processing") + `
  ` + terminal.Green("# Process multiple targets from file") + `
  golish func e 'log_info("Processing: " + target)' ` + terminal.Yellow("-T") + ` targets.txt

  ` + terminal.Green("# Function from file with targets") + `
  golish func e ` + terminal.Yellow("--function-file") + ` check.js ` + terminal.Yellow("-T") + ` targets.txt

  ` + terminal.Green("# With concurrency") + `
  golish func e 'http_get("https://" + target)' ` + terminal.Yellow("-T") + ` targets.txt ` + terminal.Yellow("-c") + ` 10

  ` + terminal.Green("# Combined with params") + `
  golish func e 'log_info(prefix + target)' ` + terminal.Yellow("-T") + ` targets.txt ` + terminal.Yellow("--params") + ` 'prefix=test_' ` + terminal.Yellow("-c") + ` 5

` + docsFooter()
}

// UsageHealth returns the Long description for the health command
func UsageHealth() string {
	return terminal.BoldCyan("◆ Description") + `
  Check the Golish environment for issues and fix them.
  ` + terminal.Gray("This command is an alias for 'golish install validate'.") + `

` + terminal.BoldCyan("✔ Checks Performed") + `
  • Base folder, workspaces, workflows folders exist (creates if missing)
  • Configuration file is valid (golish-settings.yaml)
  • All workflows are valid

` + terminal.BoldCyan("▷ Examples") + `
  golish health                 # using alias
  golish install validate       # primary command

` + docsFooter()
}

// UsageWorker returns the Long description for the worker command
func UsageWorker() string {
	return terminal.BoldCyan("◆ Description") + `
  Commands for managing worker nodes in distributed mode.

` + terminal.BoldCyan("▶ Subcommands") + `
  • ` + terminal.Yellow("join") + `    - Join the distributed worker pool
  • ` + terminal.Yellow("status") + `  - Show worker pool status (alias: ls); use ` + terminal.Yellow("--json") + ` for JSON output
  • ` + terminal.Yellow("set") + `     - Update a worker field (alias, public-ip, ssh-enabled, ssh-keys-path)
  • ` + terminal.Yellow("eval") + `    - Evaluate a function expression with distributed hooks
  • ` + terminal.Yellow("queue") + `   - Manage and process queued tasks (list, new, run)

` + docsFooter()
}

// UsageWorkerJoin returns the Long description for the worker join command
func UsageWorkerJoin() string {
	return terminal.BoldCyan("◆ Description") + `
  Join the distributed worker pool and start processing tasks.

  The worker will connect to Redis and wait for tasks from the master node.
  Tasks are executed using the local workflow engine.

` + terminal.BoldCyan("▷ Examples") + `
  ` + terminal.Green("# Join using settings from golish-settings.yaml") + `
  golish worker join

  ` + terminal.Green("# Join using a specific Redis URL") + `
  golish worker join ` + terminal.Yellow("--redis-url") + ` redis://user:pass@localhost:6379/0

  ` + terminal.Green("# Join and auto-detect public IP") + `
  golish worker join ` + terminal.Yellow("--get-public-ip") + `

` + docsFooter()
}

// UsageWorkerStatus returns the Long description for the worker status command
func UsageWorkerStatus() string {
	return terminal.BoldCyan("◆ Description") + `
  Display the status of all workers connected to the Redis server.

  Use ` + terminal.Yellow("--json") + ` to output worker info as JSON for scripting and automation.

` + terminal.BoldCyan("▷ Examples") + `
  ` + terminal.Green("# Show worker status as a table") + `
  golish worker status

  ` + terminal.Green("# Output worker info as JSON") + `
  golish worker status ` + terminal.Yellow("--json") + `

` + docsFooter()
}

// UsageWorkerEval returns the Long description for the worker eval command
func UsageWorkerEval() string {
	return terminal.BoldCyan("◆ Description") + `
  Evaluate a utility function expression with distributed hooks registered.

  This connects to Redis and registers run_on_master() hooks so that
  expressions can route calls to the master node. Useful for one-shot
  operations from a worker context (e.g., inside Docker or CI pipelines)
  without running a full worker loop.

` + terminal.BoldCyan("▷ Examples") + `
  ` + terminal.Green("# Simple function eval with distributed hooks") + `
  golish worker eval 'log_info("hello from worker eval")' ` + terminal.Yellow("--redis-url") + ` redis://localhost:6379

  ` + terminal.Green("# Route a call to the master node") + `
  golish worker eval 'run_on_master("func", "log_info(\"routed via redis\")")' ` + terminal.Yellow("--redis-url") + ` redis://localhost:6379

  ` + terminal.Green("# With target variable") + `
  golish worker eval 'log_info("hello")' ` + terminal.Yellow("-t") + ` example.com ` + terminal.Yellow("--redis-url") + ` redis://localhost:6379

  ` + terminal.Green("# Read script from stdin") + `
  echo 'run_on_master("func", "db_import_sarif(\"ws\", \"/path/f.sarif\")")' | golish worker eval ` + terminal.Yellow("--stdin") + ` ` + terminal.Yellow("--redis-url") + ` redis://localhost:6379

` + docsFooter()
}

// UsageWorkerSet returns the Long description for the worker set command
func UsageWorkerSet() string {
	return terminal.BoldCyan("◆ Description") + `
  Update a field on a registered worker. The worker can be identified by its
  ID or alias.

` + terminal.BoldCyan("▶ Valid Fields") + `
  • ` + terminal.Yellow("alias") + `          - Human-friendly name for the worker
  • ` + terminal.Yellow("public-ip") + `      - Public IP address
  • ` + terminal.Yellow("ssh-enabled") + `    - Whether SSH is enabled (true/false)
  • ` + terminal.Yellow("ssh-keys-path") + `  - Path to SSH keys

` + terminal.BoldCyan("▷ Examples") + `
  ` + terminal.Green("# Set an alias for a worker") + `
  golish worker set <worker-id> alias scanner-1

  ` + terminal.Green("# Set public IP") + `
  golish worker set scanner-1 public-ip 203.0.113.10

  ` + terminal.Green("# Enable SSH") + `
  golish worker set scanner-1 ssh-enabled true

  ` + terminal.Green("# With custom Redis URL") + `
  golish worker set <worker-id> alias prod-1 ` + terminal.Yellow("--redis-url") + ` redis://localhost:6379

` + docsFooter()
}

// UsageWorkerQueue returns the Long description for the worker queue command
func UsageWorkerQueue() string {
	return terminal.BoldCyan("◆ Description") + `
  Manage and process queued tasks. Tasks can be queued via the ` + terminal.Yellow("--queue") + ` flag
  on ` + terminal.Yellow("golish run") + ` or via ` + terminal.Yellow("golish worker queue new") + `.

` + terminal.BoldCyan("▶ Subcommands") + `
  • ` + terminal.Yellow("list") + `  - List all queued tasks (alias: ls)
  • ` + terminal.Yellow("new") + `   - Queue a new task for later processing
  • ` + terminal.Yellow("run") + `   - Process queued tasks (polls DB and Redis)

` + docsFooter()
}

// UsageWorkerQueueList returns the Long description for the worker queue list command
func UsageWorkerQueueList() string {
	return terminal.BoldCyan("◆ Description") + `
  List all queued tasks from the database.

` + terminal.BoldCyan("▷ Examples") + `
  ` + terminal.Green("# List all queued tasks") + `
  golish worker queue list

  ` + terminal.Green("# Output as JSON") + `
  golish worker queue list ` + terminal.Yellow("--json") + `

` + docsFooter()
}

// UsageWorkerQueueNew returns the Long description for the worker queue new command
func UsageWorkerQueueNew() string {
	return terminal.BoldCyan("◆ Description") + `
  Queue a new task for later processing. Creates a DB record and optionally
  pushes to Redis if configured.

` + terminal.BoldCyan("▷ Examples") + `
  ` + terminal.Green("# Queue a module run") + `
  golish worker queue new ` + terminal.Yellow("-m") + ` recon ` + terminal.Yellow("-t") + ` example.com

  ` + terminal.Green("# Queue a flow run with targets from file") + `
  golish worker queue new ` + terminal.Yellow("-f") + ` general ` + terminal.Yellow("-T") + ` targets.txt

  ` + terminal.Green("# Queue with parameters") + `
  golish worker queue new ` + terminal.Yellow("-m") + ` recon ` + terminal.Yellow("-t") + ` example.com ` + terminal.Yellow("-p") + ` 'threads=20'

` + docsFooter()
}

// UsageWorkerQueueRun returns the Long description for the worker queue run command
func UsageWorkerQueueRun() string {
	return terminal.BoldCyan("◆ Description") + `
  Process queued tasks by polling both the database and Redis (if configured).
  Uses a shared channel with deduplication to prevent double-execution.

` + terminal.BoldCyan("▷ Examples") + `
  ` + terminal.Green("# Process queued tasks with default concurrency") + `
  golish worker queue run

  ` + terminal.Green("# Process with higher concurrency") + `
  golish worker queue run ` + terminal.Yellow("--concurrency") + ` 3

  ` + terminal.Green("# Process with custom Redis URL") + `
  golish worker queue run ` + terminal.Yellow("--redis-url") + ` redis://localhost:6379

` + docsFooter()
}

// UsageConfig returns the Long description for the config command
func UsageConfig() string {
	return terminal.BoldCyan("◆ Description") + `
  Manage golish configuration settings.

` + terminal.BoldCyan("▶ Subcommands") + `
  • ` + terminal.Yellow("clean") + `  - Reset configuration to defaults
  • ` + terminal.Yellow("set") + `    - Set a configuration value
  • ` + terminal.Yellow("view") + `   - View a configuration value
  • ` + terminal.Yellow("list") + `   - List configuration values

` + docsFooter()
}

// UsageConfigClean returns the Long description for the config clean command
func UsageConfigClean() string {
	return terminal.BoldCyan("◆ Description") + `
  Reset the configuration file to default values.
  Backs up the existing config to golish-settings.yaml.backup before overwriting.

` + terminal.BoldCyan("▷ Example") + `
  ` + terminal.Green("golish config clean") + `

` + docsFooter()
}

// UsageConfigSet returns the Long description for the config set command
func UsageConfigSet() string {
	return terminal.BoldCyan("◆ Description") + `
  Set a configuration value using dot notation.

` + terminal.BoldCyan("▷ Syntax") + `
  golish config set <key> <value>
  golish config set ` + terminal.Yellow("--from-file") + ` <path>
  cat config.txt | golish config set ` + terminal.Yellow("--from-file") + ` -

` + terminal.BoldCyan("▷ Examples") + `
  ` + terminal.Green("golish config set server.port 9000") + `
  ` + terminal.Green("golish config set server.username admin") + `
  ` + terminal.Green("golish config set server.password \"d8506b99a052e797f73d1dab\"") + `
  ` + terminal.Green("golish config set server.jwt.secret_signing_key \"d8506b99a052e797f73d1dab\"") + `
  ` + terminal.Green("golish config set scan_tactic.default 20") + `
  ` + terminal.Green("golish config set global_vars.github_token ghp_xxx") + `
  ` + terminal.Green("golish config set notification.enabled true") + `

  ` + terminal.Green("# Batch set from a file") + `
  golish config set ` + terminal.Yellow("--from-file") + ` my-settings.txt

  ` + terminal.Green("# Pipe from stdin") + `
  cat my-settings.txt | golish config set ` + terminal.Yellow("--from-file") + ` -

` + terminal.BoldCyan("▷ File Format") + `
  Lines can use any of these formats:
    server.port 9000
    server.port = 9000
    golish config set server.port 9000
  Lines starting with # are ignored.

` + terminal.BoldCyan("▷ Available Keys") + `
  ` + terminal.Yellow("base_folder") + `                    Base directory path
  ` + terminal.Yellow("server.host") + `                    Server bind host
  ` + terminal.Yellow("server.port") + `                    Server port number
  ` + terminal.Yellow("server.username") + `                Auth username
  ` + terminal.Yellow("server.password") + `                Auth password
  ` + terminal.Yellow("server.simple_user_map_key.<username>") + ` Auth user password by username
  ` + terminal.Yellow("server.jwt.secret_signing_key") + `    JWT secret signing key
  ` + terminal.Yellow("server.jwt.expiration_minutes") + `    JWT expiration time in minutes
  ` + terminal.Yellow("server.ui_path") + `                 UI static files path
  ` + terminal.Yellow("server.enabled_auth_api") + `        Enable API key auth (true/false)
  ` + terminal.Yellow("server.auth_api_key") + `            API key for x-golish-api-key header
  ` + terminal.Yellow("database.db_engine") + `             sqlite or postgresql
  ` + terminal.Yellow("database.host") + `                  Database host
  ` + terminal.Yellow("database.port") + `                  Database port
  ` + terminal.Yellow("scan_tactic.aggressive") + `         Aggressive mode threads
  ` + terminal.Yellow("scan_tactic.default") + `            Default mode threads
  ` + terminal.Yellow("scan_tactic.gently") + `             Gentle mode threads
  ` + terminal.Yellow("redis.host") + `                     Redis host
  ` + terminal.Yellow("redis.port") + `                     Redis port
  ` + terminal.Yellow("global_vars.<name>") + `             Set a global variable
  ` + terminal.Yellow("notification.enabled") + `           Enable notifications (true/false)
  ` + terminal.Yellow("notification.provider") + `          Notification provider (telegram, webhook)
  ` + terminal.Yellow("notification.telegram.enabled") + `  Enable Telegram notifications (true/false)
  ` + terminal.Yellow("notification.telegram.bot_token") + ` Telegram bot token from @BotFather
  ` + terminal.Yellow("notification.telegram.chat_id") + `  Telegram chat ID to send messages to
  ` + terminal.Yellow("notification.webhooks.0.url") + `    Webhook URL (use index 0, 1, 2... for multiple)
  ` + terminal.Yellow("notification.webhooks.0.enabled") + ` Enable webhook (true/false)
  ` + terminal.Yellow("notification.webhooks.0.timeout") + ` Webhook timeout in seconds
  ` + terminal.Yellow("environments.external_binaries_path") + ` Binaries directory
  ` + terminal.Yellow("storage.enabled") + `                Enable cloud storage (true/false)

` + docsFooter()
}

func UsageConfigView() string {
	return terminal.BoldCyan("◆ Description") + `
  View a configuration value using dot notation.
  Supports wildcard patterns with --force flag.

` + terminal.BoldCyan("▷ Syntax") + `
  golish config view <key>
  golish config view '<pattern>' --force

` + terminal.BoldCyan("▷ Examples") + `
  ` + terminal.Green("# Exact key lookup") + `
  ` + terminal.Green("golish config view server.port") + `
  ` + terminal.Green("golish config view server.username") + `
  ` + terminal.Green("golish config view server.password") + `
  ` + terminal.Green("golish config view server.jwt.secret_signing_key") + `
  ` + terminal.Green("golish config view server.jwt.secret_signing_key --redact") + `

  ` + terminal.Green("# Wildcard pattern search (requires --force)") + `
  ` + terminal.Green("golish config view 'server.*' --force") + `
  ` + terminal.Green("golish config view 'database.*' --force") + `
  ` + terminal.Green("golish config view '*password*' --force") + `
  ` + terminal.Green("golish config view 'server.*' --force --redact") + `

` + docsFooter()
}

func UsageConfigList() string {
	return terminal.BoldCyan("◆ Description") + `
  List configuration values in dot notation.

` + terminal.BoldCyan("▷ Syntax") + `
  golish config list

` + terminal.BoldCyan("▷ Examples") + `
  ` + terminal.Green("golish config list") + `
  ` + terminal.Green("golish config list --show-secrets") + `

` + docsFooter()
}

// UsageDB returns the Long description for the db command
func UsageDB() string {
	return terminal.BoldCyan("◆ Description") + `
  Database management commands for seeding and cleaning data.

` + terminal.BoldCyan("▶ Subcommands") + `
  • ` + terminal.Yellow("list") + `     - List database tables and row counts
  • ` + terminal.Yellow("seed") + `     - Seed database with sample data
  • ` + terminal.Yellow("clean") + `    - Remove all data from database
  • ` + terminal.Yellow("migrate") + `  - Run database migrations

` + docsFooter()
}

// UsageDBSeed returns the Long description for the db seed command
func UsageDBSeed() string {
	return terminal.BoldCyan("◆ Description") + `
  Seed the database with sample data for development and testing.

  This command populates the database with realistic sample records including:
  • Runs (completed, running, failed examples)
  • Step results (subfinder, httpx, nuclei, etc.)
  • Artifacts (subdomains.txt, alive-hosts.txt, etc.)
  • Assets (HTTP endpoints with status codes and tech stacks)
  • Event logs (run events, asset discoveries)
  • Schedules (daily recon, weekly vuln scan)

` + terminal.BoldCyan("▷ Example") + `
  ` + terminal.Green("golish db seed") + `

` + docsFooter()
}

// UsageDBClean returns the Long description for the db clean command
func UsageDBClean() string {
	return terminal.BoldCyan("◆ Description") + `
  Remove all data from all database tables.
  Use --clean-ws to also remove workspace data (e.g. ~/workspaces-golish).

  ` + terminal.Yellow("WARNING:") + ` This is a destructive operation that cannot be undone.
  Use the --force flag to skip the confirmation prompt.

` + terminal.BoldCyan("▷ Examples") + `
  ` + terminal.Green("golish db clean --force") + `
  ` + terminal.Green("golish db clean --force --clean-ws") + `

` + docsFooter()
}

// UsageDBMigrate returns the Long description for the db migrate command
func UsageDBMigrate() string {
	return terminal.BoldCyan("◆ Description") + `
  Run database migrations to create or update tables.

  This command ensures all required tables exist with the correct schema.
  Safe to run multiple times (uses IF NOT EXISTS).

` + terminal.BoldCyan("▷ Example") + `
  ` + terminal.Green("golish db migrate") + `

` + docsFooter()
}

// UsageDBList returns the Long description for the db list command
func UsageDBList() string {
	return terminal.BoldCyan("◆ Description") + `
  List all database tables with their row counts, or list records from a
  specific table with pagination support.

` + terminal.BoldCyan("▶ Options") + `
  ` + terminal.Yellow("-t, --table") + `         Table name to list records from
  ` + terminal.Yellow("--offset") + `            Number of records to skip (default: 0)
  ` + terminal.Yellow("--limit") + `             Maximum records to return (default: 20, max: 100)
  ` + terminal.Yellow("--list-columns") + `      List all available columns for the specified table
  ` + terminal.Yellow("--exclude-columns") + `   Comma-separated column names to exclude from output

` + terminal.BoldCyan("▶ Valid Tables") + `
  runs, step_results, artifacts, assets, event_logs, schedules

` + terminal.BoldCyan("▷ Examples") + `
  ` + terminal.Green("# List all tables with row counts") + `
  golish db list

  ` + terminal.Green("# List records from runs table") + `
  golish db list ` + terminal.Yellow("-t") + ` runs

  ` + terminal.Green("# List available columns for assets table") + `
  golish db list ` + terminal.Yellow("-t") + ` assets ` + terminal.Yellow("--list-columns") + `

  ` + terminal.Green("# List assets excluding specific columns") + `
  golish db list ` + terminal.Yellow("-t") + ` assets ` + terminal.Yellow("--exclude-columns") + ` id,created_at,updated_at

  ` + terminal.Green("# List assets with pagination") + `
  golish db list ` + terminal.Yellow("-t") + ` assets ` + terminal.Yellow("--offset") + ` 0 ` + terminal.Yellow("--limit") + ` 10

  ` + terminal.Green("# Get next page of results") + `
  golish db list ` + terminal.Yellow("-t") + ` assets ` + terminal.Yellow("--offset") + ` 10 ` + terminal.Yellow("--limit") + ` 10

` + docsFooter()
}

// UsageInstall returns the Long description for the install command
func UsageInstall() string {
	return terminal.BoldCyan("◆ Description") + `
  Install workflows, base folder, or binaries from various sources.

` + terminal.BoldCyan("▶ Subcommands") + `
  • ` + terminal.Yellow("workflow") + `  - Install workflows from git URL, zip URL, or local zip
  • ` + terminal.Yellow("base") + `      - Install base folder (backs up and restores database)
  • ` + terminal.Yellow("binary") + `    - Install binaries from registry
  • ` + terminal.Yellow("env") + `       - Add binaries path to shell configuration
  • ` + terminal.Yellow("validate") + `  - Check and fix environment health
  • ` + terminal.Yellow("skills") + `    - Install coding-agent skills (alias for 'golish skills install')

` + terminal.BoldCyan("▷ Examples") + `
  ` + terminal.Green("# List available binaries (direct-fetch mode)") + `
  golish install binary ` + terminal.Yellow("--list-registry-direct-fetch") + `

  ` + terminal.Green("# List available binaries (nix-build mode)") + `
  golish install binary ` + terminal.Yellow("--list-registry-nix-build") + `

  ` + terminal.Green("# Install specific binaries") + `
  golish install binary ` + terminal.Yellow("--name") + ` nuclei ` + terminal.Yellow("--name") + ` httpx

  ` + terminal.Green("# Install all required binaries") + `
  golish install binary ` + terminal.Yellow("--all") + `

  ` + terminal.Green("# Install all binaries including optional ones") + `
  golish install binary ` + terminal.Yellow("--all") + ` ` + terminal.Yellow("--install-optional") + `

  ` + terminal.Green("# Check if binaries are installed") + `
  golish install binary ` + terminal.Yellow("--all") + ` ` + terminal.Yellow("--check") + `

  ` + terminal.Green("# Install Nix package manager") + `
  golish install binary ` + terminal.Yellow("--nix-installation") + `

  ` + terminal.Green("# Install binary via Nix") + `
  golish install binary ` + terminal.Yellow("--name") + ` nuclei ` + terminal.Yellow("--nix-build-install") + `

  ` + terminal.Green("# Install all binaries via Nix") + `
  golish install binary ` + terminal.Yellow("--all") + ` ` + terminal.Yellow("--nix-build-install") + `

  ` + terminal.Green("# Install workflows from git or from a zip URL or from a local zip file") + `
  golish install workflow https://github.com/user/golish-workflows.git
  golish install workflow http://<custom-host>/workflow-golish.zip
  golish install workflow local-file-workflow-golish.zip

  ` + terminal.Green("# Install base folder from git") + `
  golish install base https://github.com/user/golish-base.git
  golish install base http://<custom-host>/golish-base.zip
  golish install base local-file-golish-base.zip

` + docsFooter()
}

// UsageOrg returns usage information for the org command
func UsageOrg() string {
	return terminal.BoldCyan("◆ Description") + `
  Group multiple workspaces under one org so assets, findings and runs can be
  queried across all of them at once.

  Golish derives a workspace from each target, which usually means one apex
  domain per workspace. An org sits above that: a company with many root domains
  gets one org covering every workspace, and ` + terminal.Yellow("--org") + ` scopes any query to it.

  ` + terminal.Bold("Orgs are opt-in and additive.") + ` Every row without an explicit org belongs to
  the ` + terminal.Yellow("default") + ` org, and a command with no ` + terminal.Yellow("--org") + ` and no active org spans all orgs,
  so existing scans and scripts behave exactly as they did before.

` + terminal.BoldCyan("▶ Subcommands") + `
  • ` + terminal.Yellow("list") + `     - List orgs with their data counts (default when no subcommand is given)
  • ` + terminal.Yellow("create") + `   - Create a new org
  • ` + terminal.Yellow("show") + `     - Show one org's details, counts and workspaces
  • ` + terminal.Yellow("use") + `      - Set the active org for later commands
  • ` + terminal.Yellow("assign") + `   - Move existing workspaces into an org
  • ` + terminal.Yellow("rename") + `   - Rename an org
  • ` + terminal.Yellow("delete") + `   - Delete an org, reassigning or purging its data

` + terminal.BoldCyan("▶ Org selection") + `
  Every command accepts ` + terminal.Yellow("--org <name|uuid>") + `. When it is not given, golish falls
  back in this order:

    1. ` + terminal.Yellow("--org") + ` flag
    2. ` + terminal.Yellow("$GOLISH_ORG_UUID") + `
    3. ` + terminal.Yellow("$GOLISH_ORG") + `
    4. the active org set by ` + terminal.Yellow("golish org use") + `
    5. no filter - data from every org is shown

` + terminal.BoldCyan("▷ Examples") + `
  ` + terminal.Green("# Create an org and group existing workspaces into it") + `
  golish org create acme ` + terminal.Yellow("--description") + ` "ACME Corp"
  golish org assign acme ` + terminal.Yellow("-w") + ` acme.com ` + terminal.Yellow("-w") + ` acme.io

  ` + terminal.Green("# Query across every workspace in the org") + `
  golish assets ` + terminal.Yellow("--org") + ` acme
  golish assets ` + terminal.Yellow("--org") + ` acme ` + terminal.Yellow("--type") + ` web

  ` + terminal.Green("# Scan into an org") + `
  golish run ` + terminal.Yellow("-f") + ` general ` + terminal.Yellow("-t") + ` acme.com ` + terminal.Yellow("--org") + ` acme

  ` + terminal.Green("# Pin an org so later commands do not need --org") + `
  eval $(golish org use acme)
  golish org use ` + terminal.Yellow("--clear") + `

  ` + terminal.Green("# Inspect one org") + `
  golish org show acme

  ` + terminal.Green("# Delete an org but keep its data (moves to the default org)") + `
  golish org delete acme

  ` + terminal.Green("# Delete an org and everything in it") + `
  golish org delete acme ` + terminal.Yellow("--purge") + `

` + docsFooter()
}

// UsageSkills returns usage information for the skills command
func UsageSkills() string {
	return terminal.BoldCyan("◆ Description") + `
  List, read, and install the coding-agent skill bundles embedded in this binary.

  A skill teaches an AI coding agent (Claude Code, Codex, or any agent that reads
  a skills directory) how to write golish workflows and drive the CLI. Because
  the content ships inside the binary, an installed skill always matches the
  version of golish you are running.

` + terminal.BoldCyan("▶ Subcommands") + `
  • ` + terminal.Yellow("list") + `     - List bundled skills (default when no subcommand is given)
  • ` + terminal.Yellow("get") + `      - Print a skill's content to stdout
  • ` + terminal.Yellow("install") + `  - Copy a skill into an agent's skills directory

` + terminal.BoldCyan("▶ Destinations") + `
  ` + terminal.Yellow("--agent claude") + `        .claude/skills/    ` + terminal.Gray("(project)") + `    ~/.claude/skills/    ` + terminal.Gray("(global)") + `
  ` + terminal.Yellow("--agent codex") + `         .agents/skills/    ` + terminal.Gray("(project)") + `    ~/.agents/skills/    ` + terminal.Gray("(global)") + `

` + terminal.BoldCyan("▷ Examples") + `
  ` + terminal.Green("# List what is bundled") + `
  golish skills list

  ` + terminal.Green("# Install the default skill into ./.claude/skills/") + `
  golish skills install

  ` + terminal.Green("# Install globally so every project sees it") + `
  golish skills install ` + terminal.Yellow("--scope") + ` global

  ` + terminal.Green("# Install for an agent that reads .agents/skills/") + `
  golish skills install ` + terminal.Yellow("--agent") + ` codex

  ` + terminal.Green("# Install every bundle, overwriting existing copies") + `
  golish skills install ` + terminal.Yellow("--all") + ` ` + terminal.Yellow("--force") + `

  ` + terminal.Green("# Install to an explicit directory") + `
  golish skills install ` + terminal.Yellow("--dir") + ` ~/my-agent/skills

  ` + terminal.Green("# Read a skill, including its reference files") + `
  golish skills get golish-expert ` + terminal.Yellow("--full") + `

  ` + terminal.Green("# Same thing, from the install command tree") + `
  golish install skills

` + docsFooter()
}

// UsageAllExamples returns comprehensive usage examples for all commands
func UsageAllExamples() string {
	return terminal.BoldCyan("▶ Run Examples") + `
  ` + terminal.Green("# Basic module run") + `
  golish run ` + terminal.Yellow("-m") + ` recon ` + terminal.Yellow("-t") + ` example.com

  ` + terminal.Green("# Flow workflow run") + `
  golish run ` + terminal.Yellow("-f") + ` general ` + terminal.Yellow("-t") + ` example.com

  ` + terminal.Green("# Multiple targets") + `
  golish run ` + terminal.Yellow("-m") + ` recon ` + terminal.Yellow("-t") + ` target1.com ` + terminal.Yellow("-t") + ` target2.com

  ` + terminal.Green("# Stdin input") + `
  cat urls.txt | golish run ` + terminal.Yellow("-m") + ` recon

  ` + terminal.Green("# Run with stdin input with concurrency") + `
  cat list-of-urls.txt | golish run ` + terminal.Yellow("-m") + ` simple-module ` + terminal.Yellow("--concurrency") + ` 10

  ` + terminal.Green("# With custom parameters") + `
  golish run ` + terminal.Yellow("-m") + ` recon ` + terminal.Yellow("-t") + ` example.com ` + terminal.Yellow("--params") + ` 'threads=50'

  ` + terminal.Green("# Parameters from YAML file") + `
  golish run ` + terminal.Yellow("-m") + ` recon ` + terminal.Yellow("-t") + ` example.com ` + terminal.Yellow("--params-file") + ` params.yaml

  ` + terminal.Green("# Dry-run mode") + `
  golish run ` + terminal.Yellow("-m") + ` recon ` + terminal.Yellow("-t") + ` example.com ` + terminal.Yellow("--dry-run") + `

  ` + terminal.Green("# Run module from stdin YAML") + `
  cat module.yaml | golish run ` + terminal.Yellow("--std-module") + ` ` + terminal.Yellow("-t") + ` example.com

  ` + terminal.Green("# Run module from URL") + `
  golish run ` + terminal.Yellow("--module-url") + ` https://example.com/module.yaml ` + terminal.Yellow("-t") + ` example.com

  ` + terminal.Green("# Run module from private GitHub repo") + `
  golish run ` + terminal.Yellow("--module-url") + ` https://github.com/user/private/blob/main/module.yaml ` + terminal.Yellow("-t") + ` example.com

  ` + terminal.Green("# Custom workspace") + `
  golish run ` + terminal.Yellow("-m") + ` recon ` + terminal.Yellow("-t") + ` example.com ` + terminal.Yellow("--workspace") + ` /path/to/workspace

  ` + terminal.Green("# With timeout") + `
  golish run ` + terminal.Yellow("-m") + ` recon ` + terminal.Yellow("-t") + ` example.com ` + terminal.Yellow("--timeout") + ` 2h

  ` + terminal.Green("# Repeat run continuously") + `
  golish run ` + terminal.Yellow("-m") + ` recon ` + terminal.Yellow("-t") + ` example.com ` + terminal.Yellow("--repeat") + ` ` + terminal.Yellow("--repeat-wait-time") + ` 1h

  ` + terminal.Green("# Run multiple modules in sequence") + `
  golish run ` + terminal.Yellow("-m") + ` subdomain ` + terminal.Yellow("-m") + ` portscan ` + terminal.Yellow("-m") + ` vuln ` + terminal.Yellow("-t") + ` example.com

  ` + terminal.Green("# Skip heuristics checks") + `
  golish run ` + terminal.Yellow("-m") + ` recon ` + terminal.Yellow("-t") + ` example.com ` + terminal.Yellow("--heuristics-check") + ` none

  ` + terminal.Green("# Concurrent targets") + `
  golish run ` + terminal.Yellow("-m") + ` recon ` + terminal.Yellow("-T") + ` targets.txt ` + terminal.Yellow("--concurrency") + ` 5

  ` + terminal.Green("# View chunk info") + `
  golish run ` + terminal.Yellow("-m") + ` recon ` + terminal.Yellow("-T") + ` targets.txt ` + terminal.Yellow("--chunk-size") + ` 100

  ` + terminal.Green("# Run specific chunk") + `
  golish run ` + terminal.Yellow("-m") + ` recon ` + terminal.Yellow("-T") + ` targets.txt ` + terminal.Yellow("--chunk-size") + ` 100 ` + terminal.Yellow("--chunk-part") + ` 2

  ` + terminal.Green("# Split into 4 equal chunks and run chunk 0") + `
  golish run ` + terminal.Yellow("-m") + ` recon ` + terminal.Yellow("-T") + ` targets.txt ` + terminal.Yellow("--chunk-count") + ` 4 ` + terminal.Yellow("--chunk-part") + ` 0

  ` + terminal.Green("# Register a webhook trigger") + `
  golish run ` + terminal.Yellow("--as-webhook") + ` ` + terminal.Yellow("-m") + ` recon ` + terminal.Yellow("-t") + ` example.com

  ` + terminal.Green("# Create a cron schedule (daily at 2am)") + `
  golish run ` + terminal.Yellow("--as-cron") + ` '0 2 * * *' ` + terminal.Yellow("-m") + ` recon ` + terminal.Yellow("-t") + ` example.com

` + terminal.BoldYellow("★ Function Eval (Powerful Scripting)") + `
  ` + terminal.Green("# Print markdown file") + `
  golish func e 'print_markdown_from_file("README.md")'

  ` + terminal.Green("# Log with variable substitution") + `
  golish func e 'log_info("Scanning {{target}}")' ` + terminal.Yellow("-t") + ` example.com

  ` + terminal.Green("# Save content to file") + `
  golish func e 'save_content("data", "/tmp/out.txt")'

  ` + terminal.Green("# Make HTTP request") + `
  golish func e 'http_request("https://api.example.com", "GET", {}, "")'

  ` + terminal.Green("# Sort file using Unix sort") + `
  golish func e 'sort_unix("/tmp/input.txt", "/tmp/sorted.txt")'

  ` + terminal.Green("# Read from stdin") + `
  echo 'log_info("hello")' | golish func e -

` + terminal.BoldCyan("▶ Server Examples") + `
  ` + terminal.Green("# Start server") + `
  golish serve

  ` + terminal.Green("# Custom port") + `
  golish serve ` + terminal.Yellow("--port") + ` 8080

  ` + terminal.Green("# No authentication (dev mode)") + `
  golish serve ` + terminal.Yellow("-A") + `

  ` + terminal.Green("# Distributed master mode") + `
  golish serve ` + terminal.Yellow("--master") + `

` + terminal.BoldCyan("▶ Workflow Examples") + `
  ` + terminal.Green("# List all workflows") + `
  golish workflow list

  ` + terminal.Green("# Search workflows by name or description") + `
  golish workflow ls recon
  golish workflow ls --search subdomain

  ` + terminal.Green("# Show workflow details") + `
  golish workflow show recon

  ` + terminal.Green("# Validate a workflow") + `
  golish workflow validate my-workflow

` + terminal.BoldCyan("▶ Worker Examples (Distributed Mode)") + `
  ` + terminal.Green("# Join worker pool") + `
  golish worker join

  ` + terminal.Green("# With custom Redis URL") + `
  golish worker join ` + terminal.Yellow("--redis-url") + ` redis://localhost:6379/0

  ` + terminal.Green("# Check worker status") + `
  golish worker status

  ` + terminal.Green("# Evaluate function with distributed hooks (one-shot)") + `
  golish worker eval 'run_on_master("func", "log_info(\"hello\")")' ` + terminal.Yellow("--redis-url") + ` redis://localhost:6379

` + terminal.BoldCyan("▶ Install Examples") + `
  ` + terminal.Green("# Install binary") + `
  golish install binary ` + terminal.Yellow("--name") + ` nuclei

  ` + terminal.Green("# Install multiple binaries") + `
  golish install binary ` + terminal.Yellow("--name") + ` nuclei ` + terminal.Yellow("--name") + ` httpx

  ` + terminal.Green("# Install all binaries") + `
  golish install binary ` + terminal.Yellow("--all") + `

  ` + terminal.Green("# Install Nix package manager") + `
  golish install binary ` + terminal.Yellow("--nix-installation") + `

  ` + terminal.Green("# Install binary via Nix") + `
  golish install binary ` + terminal.Yellow("--name") + ` nuclei ` + terminal.Yellow("--nix-build-install") + `

  ` + terminal.Green("# Install all binaries via Nix") + `
  golish install binary ` + terminal.Yellow("--all") + ` ` + terminal.Yellow("--nix-build-install") + `

  ` + terminal.Green("# Install workflows from git") + `
  golish install workflow https://github.com/user/workflows.git

` + terminal.BoldCyan("▶ Utility Examples") + `
  ` + terminal.Green("# Health check") + `
  golish health

  ` + terminal.Green("# Reset config") + `
  golish config clean

  ` + terminal.Green("# Set config value") + `
  golish config set server.port 9000

  ` + terminal.Green("# Database commands") + `
  golish db list
  golish db seed
  golish db clean ` + terminal.Yellow("--force") + `

` + docsFooter()
}

// UsageFullExample returns comprehensive usage with all flags for pager display
func UsageFullExample() string {
	return terminal.BoldCyan("═══════════════════════════════════════════════════════════════════") + `
` + terminal.BoldCyan("                     GOLISH FULL USAGE REFERENCE") + `
` + terminal.BoldCyan("═══════════════════════════════════════════════════════════════════") + `

` + terminal.BoldYellow("GLOBAL FLAGS") + ` (available for all commands)
` + terminal.Gray("───────────────────────────────────────────────────────────────────") + `
  ` + terminal.Yellow("--settings-file") + `        Path to settings file (default: $HOME/golish-base/golish-settings.yaml)
  ` + terminal.Yellow("-b, --base-folder") + `      Base folder containing workflows and settings
  ` + terminal.Yellow("-F, --workflow-folder") + `  Custom workflow folder path
  ` + terminal.Yellow("-v, --verbose") + `          Enable verbose output
  ` + terminal.Yellow("--debug") + `                Enable debug mode (verbose + debug logging)
  ` + terminal.Yellow("-q, --silent") + `           Silent mode - suppress all output except errors
  ` + terminal.Yellow("--log-file") + `             Path to log file (logs to both console and file)
  ` + terminal.Yellow("--log-file-tmp") + `         Create temporary log file golish-log-<timestamp>.log
  ` + terminal.Yellow("-H, --usage-example") + `    Show comprehensive usage examples
  ` + terminal.Yellow("--full-usage-example") + `   Show this full usage reference (pager mode)
  ` + terminal.Yellow("--spinner") + `              Show spinner animations during execution
  ` + terminal.Yellow("--disable-logging") + `      Disable all logging output
  ` + terminal.Yellow("--disable-color") + `        Disable colored output
  ` + terminal.Yellow("--disable-notification") + ` Disable all notifications
  ` + terminal.Yellow("--disable-db") + `           Disable database connection (lightweight mode)
  ` + terminal.Yellow("--ci-output-format") + `     Output results in JSON format for CI pipelines

` + terminal.BoldYellow("RUN COMMAND") + ` - Execute workflows
` + terminal.Gray("───────────────────────────────────────────────────────────────────") + `
  golish run [flags]

` + terminal.Cyan("  Workflow Selection:") + `
  ` + terminal.Yellow("-f, --flow") + `             Flow workflow name to execute
  ` + terminal.Yellow("-m, --module") + `           Module workflow(s) to execute (can specify multiple)
  ` + terminal.Yellow("--std-module") + `           Read module YAML from stdin
  ` + terminal.Yellow("--module-url") + `           URL to fetch module YAML from (supports GitHub private repos)

` + terminal.Cyan("  Target Selection:") + `
  ` + terminal.Yellow("-t, --target") + `           Target(s) to run against (can specify multiple)
  ` + terminal.Yellow("-T, --target-file") + `      File containing targets (one per line)
  ` + terminal.Yellow("--empty-target") + `         Run without target (generates placeholder)

` + terminal.Cyan("  Parameters:") + `
  ` + terminal.Yellow("-p, --params") + `           Additional parameters (key=value format)
  ` + terminal.Yellow("-P, --params-file") + `      File containing parameters (JSON or YAML)
  ` + terminal.Yellow("-B, --tactic") + `           Run tactic: aggressive, default, gently
  ` + terminal.Yellow("--threads-hold") + `         Override thread count (0 = use tactic default)

` + terminal.Cyan("  Execution Control:") + `
  ` + terminal.Yellow("-c, --concurrency") + `      Number of targets to run concurrently (default: 1)
  ` + terminal.Yellow("--timeout") + `              Run timeout (e.g., 2h, 3h, 1d)
  ` + terminal.Yellow("--repeat") + `               Repeat run after completion
  ` + terminal.Yellow("--repeat-wait-time") + `     Wait time between repeats (default: 1h)
  ` + terminal.Yellow("--dry-run") + `              Show what would be executed without running
  ` + terminal.Yellow("-G, --progress-bar") + `     Show progress bar during execution

` + terminal.Cyan("  Chunk Mode:") + `
  ` + terminal.Yellow("--chunk-size") + `           Split targets into chunks of N targets each (0 = disabled)
  ` + terminal.Yellow("--chunk-count") + `          Split targets into N equal chunks (0 = disabled)
  ` + terminal.Yellow("--chunk-part") + `           Execute only chunk M (0-indexed, requires --chunk-size or --chunk-count)
  ` + terminal.Yellow("--chunk-threads") + `        Override concurrency within chunk (0 = use -c value)

` + terminal.Cyan("  Workspace:") + `
  ` + terminal.Yellow("-w, --workspace") + `        Custom workspace path
  ` + terminal.Yellow("-W, --workspaces-folder") + ` Override {{Workspaces}} variable
  ` + terminal.Yellow("-S, --space") + `            Override {{TargetSpace}} variable

` + terminal.Cyan("  Filtering:") + `
  ` + terminal.Yellow("-x, --exclude") + `          Module(s) to exclude from execution
  ` + terminal.Yellow("--heuristics-check") + `     Heuristics check level: none, basic, advanced

` + terminal.Cyan("  Distributed Mode:") + `
  ` + terminal.Yellow("-D, --distributed-run") + `  Submit run to distributed worker queue
  ` + terminal.Yellow("--redis-url") + `            Redis connection URL for distributed mode

` + terminal.Cyan("  Schedule & Trigger:") + `
  ` + terminal.Yellow("--as-webhook") + `           Register a webhook trigger instead of executing
  ` + terminal.Yellow("--webhook-auth-key") + `     Authentication key for the webhook trigger
  ` + terminal.Yellow("--as-cron") + `              Create a cron schedule instead of executing (e.g., '0 2 * * *')

` + terminal.BoldYellow("SERVE COMMAND") + ` - Start REST API server
` + terminal.Gray("───────────────────────────────────────────────────────────────────") + `
  golish serve [flags]

  ` + terminal.Yellow("--host") + `                 Host to bind the server to (default: from config)
  ` + terminal.Yellow("--port") + `                 Port number for the API server
  ` + terminal.Yellow("-A, --no-auth") + `          Disable authentication (development only)
  ` + terminal.Yellow("--master") + `               Run as distributed master node
  ` + terminal.Yellow("--redis-url") + `            Redis connection URL for master mode

` + terminal.BoldYellow("WORKFLOW COMMAND") + ` - Manage workflows
` + terminal.Gray("───────────────────────────────────────────────────────────────────") + `
  golish workflow list              List available workflows (alias: ls)
  golish workflow ls <search>       Search workflows by name or description
  golish workflow show <name>       Show workflow details (alias: view)
  golish workflow validate <name>   Validate a workflow (alias: val)

` + terminal.Cyan("  List Flags:") + `
  ` + terminal.Yellow("--tags") + `                 Filter workflows by tags (comma-separated)
  ` + terminal.Yellow("--show-tags") + `            Show tags column in output

` + terminal.Cyan("  Show Flags:") + `
  ` + terminal.Yellow("-v, --verbose") + `          Show detailed variable descriptions
  ` + terminal.Yellow("--table") + `                Show metadata table instead of YAML

` + terminal.BoldYellow("FUNCTION COMMAND") + ` - Execute utility functions
` + terminal.Gray("───────────────────────────────────────────────────────────────────") + `
  golish func list                  List all available functions (alias: ls)
  golish func eval <script>         Evaluate a script (alias: e)

` + terminal.Cyan("  Eval Flags:") + `
  ` + terminal.Yellow("-e, --eval") + `             Script to evaluate
  ` + terminal.Yellow("-t, --target") + `           Target value for {{target}} variable
  ` + terminal.Yellow("--params") + `               Additional parameters (key=value format)
  ` + terminal.Yellow("--stdin") + `                Read script from stdin
  ` + terminal.Yellow("-T, --targets") + `          File containing targets (one per line)
  ` + terminal.Yellow("--function-file") + `        File containing the function/script to execute
  ` + terminal.Yellow("-c, --concurrency") + `      Number of concurrent executions (default: 1)

` + terminal.BoldYellow("WORKER COMMAND") + ` - Distributed worker management
` + terminal.Gray("───────────────────────────────────────────────────────────────────") + `
  golish worker join                Join the distributed worker pool
  golish worker status              Show worker pool status
  golish worker eval <script>       Evaluate function with distributed hooks

` + terminal.Cyan("  Join Flags:") + `
  ` + terminal.Yellow("--redis-url") + `            Redis connection URL
  ` + terminal.Yellow("--workers") + `              Number of concurrent workers (default: 5)

` + terminal.Cyan("  Status Flags:") + `
  ` + terminal.Yellow("--redis-url") + `            Redis connection URL

` + terminal.Cyan("  Eval Flags:") + `
  ` + terminal.Yellow("--redis-url") + `            Redis connection URL
  ` + terminal.Yellow("-e, --eval") + `             Script to evaluate
  ` + terminal.Yellow("-t, --target") + `           Target value for {{target}} variable
  ` + terminal.Yellow("--params") + `               Additional parameters (key=value format)
  ` + terminal.Yellow("--stdin") + `                Read script from stdin

` + terminal.BoldYellow("DATABASE COMMAND") + ` - Database management
` + terminal.Gray("───────────────────────────────────────────────────────────────────") + `
  golish db list                    List tables with row counts (alias: ls)
  golish db list -t <table>         List records from a table
  golish db seed                    Seed database with sample data
  golish db clean --force           Remove all data from database
  golish db migrate                 Run database migrations
  golish db index workflow          Index workflows from filesystem to database

` + terminal.Cyan("  List Flags:") + `
  ` + terminal.Yellow("-t, --table") + `            Table name to list records from
  ` + terminal.Yellow("--offset") + `               Number of records to skip (default: 0)
  ` + terminal.Yellow("--limit") + `                Maximum records to return (default: 50)
  ` + terminal.Yellow("--json") + `                 Output records as JSON only (bypasses TUI)
  ` + terminal.Yellow("--no-tui") + `               Disable interactive TUI mode, use plain text
  ` + terminal.Yellow("--where") + `                Filter records (key=value, can be repeated)
  ` + terminal.Yellow("--columns") + `              Comma-separated columns to display
  ` + terminal.Yellow("--search") + `               Search all columns for substring
  ` + terminal.Yellow("--width") + `                Max column width for table display (default: 30)
  ` + terminal.Yellow("--all") + `                  Show all columns including hidden ones

` + terminal.Cyan("  Clean Flags:") + `
  ` + terminal.Yellow("--force") + `                Skip confirmation prompt

` + terminal.Cyan("  Index Workflow Flags:") + `
  ` + terminal.Yellow("--force") + `                Force re-index all workflows regardless of checksum

` + terminal.BoldYellow("CONFIG COMMAND") + ` - Configuration management
` + terminal.Gray("───────────────────────────────────────────────────────────────────") + `
  golish config clean               Reset configuration to defaults
  golish config set <key> <value>   Set a configuration value
  golish config view <key>          View a configuration value
  golish config list                List configuration values

` + terminal.BoldYellow("INSTALL COMMAND") + ` - Install components
` + terminal.Gray("───────────────────────────────────────────────────────────────────") + `
  golish install workflow <source>  Install workflows from git/zip
  golish install base <source>      Install base folder
  golish install binary             Install binaries from registry
  golish install validate           Check and fix environment health (alias: val)
  golish install env                Display environment paths

` + terminal.Cyan("  Binary Flags:") + `
  ` + terminal.Yellow("-n, --name") + `             Binary name(s) to install (can be repeated)
  ` + terminal.Yellow("--all") + `                  Install all binaries from registry
  ` + terminal.Yellow("--check") + `                Check if binaries are installed
  ` + terminal.Yellow("-r, --registry") + `         Custom registry JSON file path or URL
  ` + terminal.Yellow("--nix-pkgs") + `             Nix package(s) to add (repeatable)
  ` + terminal.Yellow("--nix-build-install") + `    Use Nix to install binaries instead of direct downloads
  ` + terminal.Yellow("--nix-installation") + `     Install Nix package manager (Determinate Systems installer)

` + terminal.BoldYellow("HEALTH COMMAND") + ` - Environment health check
` + terminal.Gray("───────────────────────────────────────────────────────────────────") + `
  golish health                     Check environment for issues

` + terminal.BoldCyan("═══════════════════════════════════════════════════════════════════") + `
` + docsFooter()
}

// UsageClient returns the Long description for the client command
func UsageClient() string {
	return terminal.BoldCyan("◆ Description") + `
  Interact with a remote golish server via REST API.

` + terminal.BoldCyan("▶ Environment Variables") + `
  ` + terminal.Yellow("GOLISH_REMOTE_URL") + `      Remote server URL (e.g., http://localhost:8002)
  ` + terminal.Yellow("GOLISH_REMOTE_AUTH_KEY") + ` API authentication key for x-golish-api-key header

` + terminal.BoldCyan("▶ Subcommands") + `
  • ` + terminal.Yellow("fetch") + `  - Fetch data from server (runs, assets, vulns, etc.)
  • ` + terminal.Yellow("run") + `    - Create or cancel a run
  • ` + terminal.Yellow("exec") + `   - Execute a function remotely

` + terminal.BoldCyan("▷ Examples") + `
  ` + terminal.Green("# Configure via environment") + `
  export GOLISH_REMOTE_URL="http://localhost:8002"
  export GOLISH_REMOTE_AUTH_KEY="your-api-key"

  ` + terminal.Green("# Fetch data from different tables") + `
  golish client fetch ` + terminal.Yellow("--table") + ` assets
  golish client fetch ` + terminal.Yellow("-t") + ` runs
  golish client fetch ` + terminal.Yellow("-t") + ` vulnerabilities ` + terminal.Yellow("--severity") + ` critical

  ` + terminal.Green("# Create a run") + `
  golish client run ` + terminal.Yellow("-f") + ` basic-recon ` + terminal.Yellow("-T") + ` example.com

  ` + terminal.Green("# Cancel a run") + `
  golish client run ` + terminal.Yellow("--cancel") + ` abc123-run-uuid

  ` + terminal.Green("# Execute a function") + `
  golish client exec 'log_info("Hello from remote")'

` + docsFooter()
}

// UsageClientFetch returns the Long description for the client fetch command
func UsageClientFetch() string {
	return terminal.BoldCyan("◆ Description") + `
  Fetch data from the remote golish server.

` + terminal.BoldCyan("▶ Supported Tables") + `
  • ` + terminal.Yellow("runs") + `             - Workflow execution runs
  • ` + terminal.Yellow("step_results") + `     - Step execution results
  • ` + terminal.Yellow("artifacts") + `        - Output artifacts from runs
  • ` + terminal.Yellow("assets") + `           - HTTP assets discovered during scans (default)
  • ` + terminal.Yellow("event_logs") + `       - System event logs
  • ` + terminal.Yellow("schedules") + `        - Scheduled workflow executions
  • ` + terminal.Yellow("workspaces") + `       - Scan workspaces
  • ` + terminal.Yellow("vulnerabilities") + `  - Discovered vulnerabilities
  • ` + terminal.Yellow("asset_diffs") + `      - Asset diff snapshots
  • ` + terminal.Yellow("vuln_diffs") + `       - Vulnerability diff snapshots

` + terminal.BoldCyan("▷ Examples") + `
  ` + terminal.Green("# Fetch assets (default)") + `
  golish client fetch
  golish client fetch ` + terminal.Yellow("-t") + ` assets ` + terminal.Yellow("-w") + ` example.com

  ` + terminal.Green("# Fetch runs") + `
  golish client fetch ` + terminal.Yellow("--table") + ` runs
  golish client fetch ` + terminal.Yellow("-t") + ` runs ` + terminal.Yellow("--status") + ` running

  ` + terminal.Green("# Fetch vulnerabilities with severity filter") + `
  golish client fetch ` + terminal.Yellow("-t") + ` vulnerabilities ` + terminal.Yellow("--severity") + ` critical

  ` + terminal.Green("# Fetch step results") + `
  golish client fetch ` + terminal.Yellow("-t") + ` step_results

  ` + terminal.Green("# Pagination") + `
  golish client fetch ` + terminal.Yellow("-t") + ` assets ` + terminal.Yellow("--limit") + ` 50 ` + terminal.Yellow("--offset") + ` 100

  ` + terminal.Green("# JSON output") + `
  golish client ` + terminal.Yellow("--json") + ` fetch ` + terminal.Yellow("-t") + ` runs

` + docsFooter()
}

// UsageClientRun returns the Long description for the client run command
func UsageClientRun() string {
	return terminal.BoldCyan("◆ Description") + `
  Create or cancel a workflow run on the remote server.

` + terminal.BoldCyan("▶ Create Mode Flags") + `
  ` + terminal.Yellow("-T, --target") + `  Target to run against (required)
  One of:
  ` + terminal.Yellow("-f, --flow") + `    Flow workflow name
  ` + terminal.Yellow("-m, --module") + `  Module workflow name

` + terminal.BoldCyan("▶ Cancel Mode") + `
  ` + terminal.Yellow("--cancel") + `      Run ID to cancel (switches to cancel mode)

` + terminal.BoldCyan("▷ Examples") + `
  ` + terminal.Green("# Create a flow run") + `
  golish client run ` + terminal.Yellow("-f") + ` basic-recon ` + terminal.Yellow("-T") + ` example.com

  ` + terminal.Green("# Create a module run") + `
  golish client run ` + terminal.Yellow("-m") + ` subdomain ` + terminal.Yellow("-T") + ` example.com

  ` + terminal.Green("# Cancel a run by ID") + `
  golish client run ` + terminal.Yellow("--cancel") + ` abc123-run-uuid

  ` + terminal.Green("# JSON output") + `
  golish client ` + terminal.Yellow("--json") + ` run ` + terminal.Yellow("-f") + ` recon ` + terminal.Yellow("-T") + ` example.com

` + docsFooter()
}

// UsageClientExec returns the Long description for the client exec command
func UsageClientExec() string {
	return terminal.BoldCyan("◆ Description") + `
  Execute a utility function on the remote server.

` + terminal.BoldCyan("▷ Examples") + `
  ` + terminal.Green("# Execute a simple function") + `
  golish client exec 'log_info("Hello from remote")'

  ` + terminal.Green("# With target variable") + `
  golish client exec ` + terminal.Yellow("-t") + ` example.com 'file_exists("{{target}}/output.txt")'

  ` + terminal.Green("# Using --script flag") + `
  golish client exec ` + terminal.Yellow("-s") + ` 'trim("  hello  ")'

  ` + terminal.Green("# JSON output") + `
  golish client ` + terminal.Yellow("--json") + ` exec 'trim("  test  ")'

` + docsFooter()
}

// UsageUninstall returns the Long description for the uninstall command
func UsageUninstall() string {
	return terminal.BoldCyan("◆ Description") + `
  Remove Golish installation including base folder, configuration,
  and optionally workspace data.

  ` + terminal.BoldRed("WARNING: This is a destructive and irreversible operation!") + `

` + terminal.BoldCyan("▶ What Gets Removed") + `
  • ` + terminal.Yellow("~/golish-base") + `         - Settings, workflows, binaries, data
  • ` + terminal.Yellow("~/.golish") + `             - Initialization marker
  • ` + terminal.Yellow("golish binary") + `         - Removed from PATH (up to 3 locations)

  With ` + terminal.Yellow("--clean") + `:
  • ` + terminal.Yellow("~/workspaces-golish") + `   - All scan results and workspace data

` + terminal.BoldCyan("▷ Examples") + `
  ` + terminal.Green("# Preview what will be removed (no --force = confirmation prompt)") + `
  golish uninstall

  ` + terminal.Green("# Uninstall without workspaces (keeps scan results)") + `
  golish uninstall ` + terminal.Yellow("--force") + `

  ` + terminal.Green("# Full uninstall including all scan data") + `
  golish uninstall ` + terminal.Yellow("--force") + ` ` + terminal.Yellow("--clean") + `

` + docsFooter()
}

// UsageAssets returns the Long description for the assets command
func UsageAssets() string {
	return terminal.BoldCyan("◆ Description") + `
  Query and list discovered assets from the database.
  A shortcut for ` + terminal.Yellow("golish db ls -t assets") + ` with first-class support
  for fuzzy search, source/type filtering, and asset statistics.

` + terminal.BoldCyan("▷ Examples") + `
  ` + terminal.Green("# List all assets (default columns)") + `
  golish assets

  ` + terminal.Green("# Fuzzy search across asset fields") + `
  golish assets example.com

  ` + terminal.Green("# Filter by workspace") + `
  golish assets ` + terminal.Yellow("-w") + ` myworkspace

  ` + terminal.Green("# Filter by source (fuzzy match)") + `
  golish assets ` + terminal.Yellow("--source") + ` httpx

  ` + terminal.Green("# Filter by asset type (fuzzy match)") + `
  golish assets ` + terminal.Yellow("--type") + ` web

  ` + terminal.Green("# Filter by asset value (fuzzy match)") + `
  golish assets ` + terminal.Yellow("--value") + ` api.example.com

  ` + terminal.Green("# Filter by any column (fuzzy match, repeatable)") + `
  golish assets ` + terminal.Yellow("--where") + ` status_code=200
  golish assets ` + terminal.Yellow("--where") + ` title=nginx ` + terminal.Yellow("--where") + ` source=httpx

  ` + terminal.Green("# Full-text search across all columns") + `
  golish assets ` + terminal.Yellow("--search") + ` example.com

  ` + terminal.Green("# Combined filters") + `
  golish assets ` + terminal.Yellow("--source") + ` httpx ` + terminal.Yellow("--type") + ` web
  golish assets ` + terminal.Yellow("-w") + ` myworkspace ` + terminal.Yellow("--where") + ` status_code=200 ` + terminal.Yellow("--json") + `

  ` + terminal.Green("# Show asset statistics") + `
  golish assets ` + terminal.Yellow("--stats") + `

  ` + terminal.Green("# Stats filtered by workspace") + `
  golish assets ` + terminal.Yellow("--stats") + ` ` + terminal.Yellow("-w") + ` myworkspace

  ` + terminal.Green("# With pagination") + `
  golish assets example.com ` + terminal.Yellow("--limit") + ` 100

  ` + terminal.Green("# JSON output") + `
  golish assets example.com ` + terminal.Yellow("--json") + `

  ` + terminal.Green("# Custom columns") + `
  golish assets ` + terminal.Yellow("--columns") + ` "asset_value,url,status_code"

` + docsFooter()
}

// docsFooter returns the documentation footer
// UsageAgent returns the Long description for the agent command
func UsageAgent() string {
	return terminal.BoldCyan("◆ Description") + `
  Run an ACP (Agent Communication Protocol) agent interactively from the terminal.
  Spawns a coding agent subprocess and sends a prompt, streaming output to stdout.

` + terminal.BoldCyan("▷ Examples") + `
  ` + terminal.Green("# Run with a message") + `
  golish agent "Summarize the code in this directory"

  ` + terminal.Green("# Use a specific agent") + `
  golish agent ` + terminal.Yellow("--agent") + ` codex "Explain this project"

  ` + terminal.Green("# Read message from stdin") + `
  echo "Analyze this" | golish agent ` + terminal.Yellow("--stdin") + `

  ` + terminal.Green("# Pipe with -") + `
  echo "Hello" | golish agent -

  ` + terminal.Green("# Set working directory and timeout") + `
  golish agent ` + terminal.Yellow("--cwd") + ` /path/to/project ` + terminal.Yellow("--timeout") + ` 1h "Review the code"

  ` + terminal.Green("# List available agents") + `
  golish agent ` + terminal.Yellow("--list") + `

` + docsFooter()
}

// UsageQuery returns the Long description for the query command
func UsageQuery() string {
	return terminal.BoldCyan("◆ Description") + `
  Agent-friendly commands for querying scan data.
  All subcommands support ` + terminal.Yellow("--json") + ` for machine-readable output.

` + terminal.BoldCyan("▶ Subcommands") + `
  • ` + terminal.Yellow("vulns") + `   - Query vulnerabilities
  • ` + terminal.Yellow("runs") + `    - Query workflow runs
  • ` + terminal.Yellow("steps") + `   - Query steps for a specific run

` + terminal.BoldCyan("▶ Filtering") + `
  All subcommands support ` + terminal.Yellow("--where") + ` for filtering by any column:
    ` + terminal.Yellow("--where") + ` key=value    (can be repeated for multiple filters)
    ` + terminal.Yellow("--search") + ` text        (full-text search across all columns)

  Each subcommand also has typed convenience flags (e.g. ` + terminal.Yellow("--severity") + `,
  ` + terminal.Yellow("--status") + `) that map to the underlying column.

` + terminal.BoldCyan("▷ Examples") + `
  ` + terminal.Green("# List vulnerabilities as JSON") + `
  golish query vulns ` + terminal.Yellow("--json") + `

  ` + terminal.Green("# Filter by any column") + `
  golish query vulns ` + terminal.Yellow("--where") + ` source=nuclei ` + terminal.Yellow("--json") + `

  ` + terminal.Green("# List running workflows") + `
  golish query runs ` + terminal.Yellow("--status") + ` running ` + terminal.Yellow("--json") + `

  ` + terminal.Green("# Full-text search across columns") + `
  golish query runs ` + terminal.Yellow("--search") + ` example.com ` + terminal.Yellow("--json") + `

  ` + terminal.Green("# List steps for a run") + `
  golish query steps ` + terminal.Yellow("-r") + ` <run-uuid> ` + terminal.Yellow("--json") + `

` + docsFooter()
}

// UsageQueryVulns returns the Long description for the query vulns command
func UsageQueryVulns() string {
	return terminal.BoldCyan("◆ Description") + `
  Query vulnerabilities from the database with filtering and pagination.
  Typed flags are shortcuts for common filters. Use ` + terminal.Yellow("--where") + ` for any column.

` + terminal.BoldCyan("▷ Examples") + `
  ` + terminal.Green("# List all vulnerabilities") + `
  golish query vulns

  ` + terminal.Green("# JSON output") + `
  golish query vulns ` + terminal.Yellow("--json") + `

  ` + terminal.Green("# Filter by workspace and severity") + `
  golish query vulns ` + terminal.Yellow("-w") + ` example.com ` + terminal.Yellow("--severity") + ` critical

  ` + terminal.Green("# Filter by confidence") + `
  golish query vulns ` + terminal.Yellow("--confidence") + ` confirmed ` + terminal.Yellow("--json") + `

  ` + terminal.Green("# Filter by asset") + `
  golish query vulns ` + terminal.Yellow("--asset") + ` api.example.com ` + terminal.Yellow("--json") + `

  ` + terminal.Green("# Filter by any column with --where") + `
  golish query vulns ` + terminal.Yellow("--where") + ` source=nuclei ` + terminal.Yellow("--json") + `
  golish query vulns ` + terminal.Yellow("--where") + ` asset_type=web ` + terminal.Yellow("--where") + ` severity=high

  ` + terminal.Green("# Full-text search") + `
  golish query vulns ` + terminal.Yellow("--search") + ` sql-injection ` + terminal.Yellow("--json") + `

  ` + terminal.Green("# With pagination") + `
  golish query vulns ` + terminal.Yellow("--limit") + ` 100 ` + terminal.Yellow("--offset") + ` 50

` + docsFooter()
}

// UsageQueryRuns returns the Long description for the query runs command
func UsageQueryRuns() string {
	return terminal.BoldCyan("◆ Description") + `
  Query workflow runs from the database with filtering and pagination.
  Typed flags are shortcuts for common filters. Use ` + terminal.Yellow("--where") + ` for any column.

` + terminal.BoldCyan("▷ Examples") + `
  ` + terminal.Green("# List all runs") + `
  golish query runs

  ` + terminal.Green("# JSON output") + `
  golish query runs ` + terminal.Yellow("--json") + `

  ` + terminal.Green("# Filter by status") + `
  golish query runs ` + terminal.Yellow("--status") + ` running ` + terminal.Yellow("--json") + `

  ` + terminal.Green("# Filter by workflow name") + `
  golish query runs ` + terminal.Yellow("--workflow") + ` basic-recon

  ` + terminal.Green("# Filter by target") + `
  golish query runs ` + terminal.Yellow("--target") + ` example.com ` + terminal.Yellow("--json") + `

  ` + terminal.Green("# Filter by any column with --where") + `
  golish query runs ` + terminal.Yellow("--where") + ` trigger_type=cron ` + terminal.Yellow("--json") + `
  golish query runs ` + terminal.Yellow("--where") + ` workflow_kind=flow ` + terminal.Yellow("--where") + ` status=completed

  ` + terminal.Green("# Full-text search") + `
  golish query runs ` + terminal.Yellow("--search") + ` example.com ` + terminal.Yellow("--json") + `

  ` + terminal.Green("# Filter by workspace") + `
  golish query runs ` + terminal.Yellow("-w") + ` myworkspace

` + docsFooter()
}

// UsageQuerySteps returns the Long description for the query steps command
func UsageQuerySteps() string {
	return terminal.BoldCyan("◆ Description") + `
  Query steps for a specific workflow run.
  Use ` + terminal.Yellow("--where") + ` to filter by any step column (e.g. status, step_type).

` + terminal.BoldCyan("▷ Examples") + `
  ` + terminal.Green("# List steps for a run") + `
  golish query steps ` + terminal.Yellow("-r") + ` <run-uuid>

  ` + terminal.Green("# JSON output") + `
  golish query steps ` + terminal.Yellow("-r") + ` <run-uuid> ` + terminal.Yellow("--json") + `

  ` + terminal.Green("# Filter steps by status") + `
  golish query steps ` + terminal.Yellow("-r") + ` <run-uuid> ` + terminal.Yellow("--where") + ` status=failed ` + terminal.Yellow("--json") + `

  ` + terminal.Green("# Filter by step type") + `
  golish query steps ` + terminal.Yellow("-r") + ` <run-uuid> ` + terminal.Yellow("--where") + ` step_type=bash

  ` + terminal.Green("# Custom columns") + `
  golish query steps ` + terminal.Yellow("-r") + ` <run-uuid> ` + terminal.Yellow("--columns") + ` step_name,status,duration_ms

` + docsFooter()
}

// UsageRunStatus returns the Long description for the run status command
func UsageRunStatus() string {
	return terminal.BoldCyan("◆ Description") + `
  Show the current status of a workflow run.

` + terminal.BoldCyan("▷ Examples") + `
  ` + terminal.Green("# Show run status") + `
  golish run status <run-uuid>

  ` + terminal.Green("# JSON output") + `
  golish run status <run-uuid> ` + terminal.Yellow("--json") + `

` + docsFooter()
}

// UsageRunCancel returns the Long description for the run cancel command
func UsageRunCancel() string {
	return terminal.BoldCyan("◆ Description") + `
  Cancel a pending or running workflow. Terminates associated processes
  and updates the run status to cancelled.

` + terminal.BoldCyan("▷ Examples") + `
  ` + terminal.Green("# Cancel a run") + `
  golish run cancel <run-uuid>

  ` + terminal.Green("# Cancel with JSON output") + `
  golish run cancel <run-uuid> ` + terminal.Yellow("--json") + `

` + docsFooter()
}

func docsFooter() string {
	return terminal.HiCyan("📖 Documentation: ") + terminal.HiWhite(core.DOCS) + "\n"
}
