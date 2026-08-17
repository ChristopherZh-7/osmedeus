# Cloud Quick Reference

## Setup (30 seconds)

```bash
# Enable cloud feature
golish config set cloud.enabled true

# Set credentials (pick your provider)
golish cloud config set providers.aws.access_key_id ${AWS_ACCESS_KEY_ID}
golish cloud config set providers.aws.secret_access_key ${AWS_SECRET_ACCESS_KEY}
golish cloud config set providers.aws.region ap-southeast-1
golish cloud config set defaults.provider aws

# SSH keys
golish cloud config set ssh.private_key_path ~/.ssh/id_rsa
golish cloud config set ssh.public_key_path ~/.ssh/id_rsa.pub

# Clean the setup scripts first
golish cloud config set setup.commands.clear ""

# Worker setup commands
golish cloud config set setup.commands.add "curl -fsSL https://raw.githubusercontent.com/ChristopherZh-7/golish-registry/main/install.sh | bash"
golish cloud config set setup.commands.add "golish install base --preset"
```

## Configuration

```bash
golish cloud config list                              # View all settings
golish cloud config set <key> <value>                 # Set a value
golish cloud config set <key>.add <value>             # Append to list
golish cloud config clean                             # Reset to defaults

# Provider credentials
golish cloud config set providers.<provider>.<key> <value>

# Instance type
golish cloud config set providers.aws.instance_type t3.large

# Spot instances (70-80% cheaper)
golish cloud config set providers.aws.use_spot true

# Cost limits
golish cloud config set limits.max_hourly_spend 1.00
golish cloud config set limits.max_total_spend 10.00
golish cloud config set limits.max_instances 10
```

## Infrastructure

```bash
golish cloud create --provider aws -n 3               # Create instances
golish cloud list                                     # List active infra
golish cloud destroy <infra-id>                       # Destroy by ID
golish cloud destroy all --force                      # Destroy everything
golish cloud setup --reuse-with "1.2.3.4,5.6.7.8"    # Setup existing machines
```

## Workflow Mode

```bash
# Basic
golish cloud run -f fast -t example.com
golish cloud run -m enum-subdomain -t example.com --timeout 30m

# Multiple instances
golish cloud run -f general -t example.com --instances 3 --provider aws

# Multiple targets distributed across workers
golish cloud run -f fast -T targets.txt --instances 5
golish cloud run -f fast -T targets.txt --chunk-size 10    # 10 targets per worker
golish cloud run -f fast -T targets.txt --chunk-count 3    # Split into 3 chunks

# Reuse existing infrastructure
golish cloud run -f fast -t example.com --reuse
golish cloud run -f fast -t example.com --reuse-with "1.2.3.4,5.6.7.8"

# Sync results back + auto-destroy
golish cloud run -f fast -t example.com --sync-back --auto-destroy
```

## Custom Command Mode

Run arbitrary commands on cloud instances (mutually exclusive with `-f`/`-m`):

```bash
# Single command
golish cloud run --custom-cmd "nmap -sV {{Target}}" -t example.com

# Multiple sequential commands
golish cloud run \
  --custom-cmd "subfinder -d {{Target}} -o /tmp/golish-custom/subs.txt" \
  --custom-cmd "cat /tmp/golish-custom/subs.txt | httpx -o /tmp/golish-custom/live.txt" \
  -t example.com

# Post-commands (run only if all custom-cmds succeed)
golish cloud run \
  --custom-cmd "nuclei -u {{Target}} -o /tmp/golish-custom/results.txt" \
  --custom-post-cmd "cat /tmp/golish-custom/results.txt | notify" \
  -t example.com

# Sync results back
golish cloud run \
  --custom-cmd "nmap -sV {{Target}} -oA /tmp/golish-custom/scan" \
  --sync-path "/tmp/golish-custom/" \
  --sync-dest "./my-results" \
  -t example.com

# Distribute targets across workers
golish cloud run \
  --custom-cmd "cat {{Target}} | httpx -o /tmp/golish-custom/live.txt" \
  --sync-path "/tmp/golish-custom/live.txt" \
  -T targets.txt --instances 5 --auto-destroy
```

### Template Variables

| Variable | Description |
|----------|-------------|
| `{{Target}}` | Target string or chunk file path (with `-T`) |
| `{{public_ip}}` | Worker's public IP |
| `{{private_ip}}` | Worker's private IP |
| `{{worker_name}}` | Resource name |
| `{{worker_id}}` | Cloud resource ID |
| `{{infra_id}}` | Infrastructure ID |
| `{{provider}}` | Provider name |
| `{{ssh_user}}` | SSH username |
| `{{index}}` | Worker index (0, 1, 2, ...) |

### Behavior

- Commands run in `/tmp/golish-custom/` on the remote
- Custom-cmds run sequentially per worker, in parallel across workers
- First failure stops remaining commands and skips post-cmds for that worker
- Sync downloads to: `<sync-dest>/<worker_name>-<ip>/<remote_path>`

## Flags Reference

| Flag | Short | Description |
|------|-------|-------------|
| `--flow` | `-f` | Flow workflow name |
| `--module` | `-m` | Module workflow name |
| `--target` | `-t` | Single target |
| `--target-file` | `-T` | File containing targets |
| `--provider` | `-p` | Cloud provider |
| `--instances` | `-n` | Number of instances |
| `--timeout` | | Scan timeout (e.g., `2h`, `30m`) |
| `--auto-destroy` | | Destroy infrastructure after completion |
| `--reuse` | | Auto-discover existing infrastructure |
| `--reuse-with` | | Reuse specific IPs (comma-separated) |
| `--sync-back` | | Download workflow results (workflow mode) |
| `--verbose-setup` | | Show full setup command output |
| `--ansible` | | Use Ansible playbook for setup |
| `--chunk-size` | | Targets per worker chunk |
| `--chunk-count` | | Split targets into N chunks |
| `--custom-cmd` | | Custom command (repeatable) |
| `--custom-post-cmd` | | Post-command (repeatable) |
| `--sync-path` | | Remote path to download (repeatable) |
| `--sync-dest` | | Local sync directory (default: `./golish-sync-back`) |

## Cost Reference

| Provider | Instance | vCPU | RAM | Hourly |
|----------|----------|------|-----|--------|
| Hetzner | cx22 | 2 | 4 GB | ~$0.007 |
| Linode | g6-standard-2 | 2 | 4 GB | $0.018 |
| DigitalOcean | s-2vcpu-4gb | 2 | 4 GB | $0.02232 |
| AWS | t3.medium | 2 | 4 GB | $0.0416 |
| GCP | n1-standard-2 | 2 | 7.5 GB | $0.095 |
| Azure | Standard_B2s | 2 | 4 GB | $0.042 |
