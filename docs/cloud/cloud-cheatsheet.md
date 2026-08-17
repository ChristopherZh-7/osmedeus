# Cloud Cheatsheet

## First-Time Setup

```bash
# 0. Enable cloud feature
golish config set cloud.enabled true

# 1. Credentials (pick one provider)
golish cloud config set providers.aws.access_key_id <key>
golish cloud config set providers.aws.secret_access_key <secret>
golish cloud config set providers.aws.region ap-southeast-1
golish cloud config set defaults.provider aws

# 2. SSH
golish cloud config set ssh.private_key_path ~/.ssh/id_rsa
golish cloud config set ssh.public_key_path ~/.ssh/id_rsa.pub

# 3. Clean the setup scripts first, then add worker setup
golish cloud config set setup.commands.clear ""
golish cloud config set setup.commands.add "curl -fsSL https://raw.githubusercontent.com/ChristopherZh-7/golish-registry/main/install.sh | bash"
golish cloud config set setup.commands.add "golish install base --preset"

# 4. Cost limits (recommended)
golish cloud config set limits.max_hourly_spend 1.00
golish cloud config set limits.max_total_spend 10.00
```

## Workflow Mode

```bash
golish cloud run -f fast -t example.com                          # Single target
golish cloud run -f fast -T targets.txt --instances 5            # Distributed
golish cloud run -f fast -t example.com --sync-back              # Sync results
golish cloud run -f fast -t example.com --auto-destroy           # Auto cleanup
golish cloud run -f fast -t example.com --sync-back --auto-destroy  # Full lifecycle
golish cloud run -f fast -t example.com --reuse                  # Reuse infra
golish cloud run -m enum-subdomain -t example.com --timeout 30m  # Module + timeout
```

## Custom Command Mode

```bash
# Run anything on cloud instances
golish cloud run --custom-cmd "nmap -sV {{Target}}" -t example.com

# Pipeline: multiple commands, sync results
golish cloud run \
  --custom-cmd "subfinder -d {{Target}} -o /tmp/golish-custom/subs.txt" \
  --custom-cmd "cat /tmp/golish-custom/subs.txt | httpx -o /tmp/golish-custom/live.txt" \
  --custom-post-cmd "wc -l /tmp/golish-custom/live.txt" \
  --sync-path "/tmp/golish-custom/" \
  -t example.com --auto-destroy

# Distribute targets, sync to custom dir
golish cloud run \
  --custom-cmd "cat {{Target}} | nuclei -o /tmp/golish-custom/nuclei.txt" \
  --sync-path "/tmp/golish-custom/nuclei.txt" \
  --sync-dest "./nuclei-results" \
  -T targets.txt --instances 5
```

### Variables: `{{Target}}` `{{public_ip}}` `{{private_ip}}` `{{worker_name}}` `{{worker_id}}` `{{infra_id}}` `{{provider}}` `{{ssh_user}}` `{{index}}`

### Rules
- Commands run in `/tmp/golish-custom/` on remote
- Sequential per worker, parallel across workers
- First failure skips remaining cmds + post-cmds
- Sync destination: `<sync-dest>/<worker_name>-<ip>/<path>`

## Infrastructure

```bash
golish cloud create --provider aws -n 3     # Create
golish cloud list                           # List
golish cloud destroy <id>                   # Destroy one
golish cloud destroy all --force            # Destroy all
golish cloud setup --reuse-with "1.2.3.4"   # Setup existing
```

## Config

```bash
golish cloud config list                    # View
golish cloud config set <key> <value>       # Set
golish cloud config set <key>.add <value>   # Append to list
golish cloud config clean                   # Reset
```

## Provider Quick Config

**AWS:**
```bash
golish cloud config set providers.aws.access_key_id ${AWS_ACCESS_KEY_ID}
golish cloud config set providers.aws.secret_access_key ${AWS_SECRET_ACCESS_KEY}
golish cloud config set providers.aws.region ap-southeast-1
golish cloud config set providers.aws.instance_type t3.medium
golish cloud config set providers.aws.use_spot true          # 70% cheaper
```

**Hetzner:**
```bash
golish cloud config set providers.hetzner.token ${HETZNER_API_TOKEN}
golish cloud config set providers.hetzner.location fsn1
golish cloud config set providers.hetzner.server_type cx22
```

**DigitalOcean:**
```bash
golish cloud config set providers.digitalocean.token ${DO_TOKEN}
golish cloud config set providers.digitalocean.region sgp1
golish cloud config set providers.digitalocean.size s-2vcpu-4gb
```

**GCP:**
```bash
golish cloud config set providers.gcp.project_id ${GCP_PROJECT}
golish cloud config set providers.gcp.credentials_file /path/to/sa-key.json
golish cloud config set providers.gcp.region us-central1
golish cloud config set providers.gcp.zone us-central1-a
golish cloud config set providers.gcp.machine_type n1-standard-2
```

**Linode:**
```bash
golish cloud config set providers.linode.token ${LINODE_TOKEN}
golish cloud config set providers.linode.region ap-south
golish cloud config set providers.linode.type g6-standard-2
```

**Azure:**
```bash
golish cloud config set providers.azure.subscription_id ${AZURE_SUB_ID}
golish cloud config set providers.azure.tenant_id ${AZURE_TENANT_ID}
golish cloud config set providers.azure.client_id ${AZURE_CLIENT_ID}
golish cloud config set providers.azure.client_secret ${AZURE_CLIENT_SECRET}
golish cloud config set providers.azure.location southeastasia
golish cloud config set providers.azure.vm_size Standard_B2s
```

## Cost Reference

| Provider | Instance | vCPU | RAM | $/hr |
|----------|----------|------|-----|------|
| Hetzner | cx22 | 2 | 4 GB | 0.007 |
| Linode | g6-standard-2 | 2 | 4 GB | 0.018 |
| DigitalOcean | s-2vcpu-4gb | 2 | 4 GB | 0.022 |
| AWS | t3.medium | 2 | 4 GB | 0.042 |
| Azure | Standard_B2s | 2 | 4 GB | 0.042 |
| GCP | n1-standard-2 | 2 | 7.5 GB | 0.095 |

5 x Hetzner cx22 x 2 hours = **$0.07** | 5 x DO s-2vcpu-4gb x 2 hours = **$0.22**

## Troubleshooting

```bash
golish cloud run -f fast -t example.com --verbose-setup   # See setup output
golish cloud run -f fast -t example.com --debug            # Full debug logs
golish cloud list                                          # Check for orphans
golish cloud destroy all --force                           # Emergency cleanup
```
