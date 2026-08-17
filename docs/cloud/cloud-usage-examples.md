# Cloud Usage Examples

Practical examples for running distributed security scans and custom commands on cloud infrastructure.

## Getting Started

### First Scan in 5 Minutes

```bash
# Step 0: Enable cloud feature
golish config set cloud.enabled true

# Step 1: Configure AWS credentials
golish cloud config set providers.aws.access_key_id ${AWS_ACCESS_KEY_ID}
golish cloud config set providers.aws.secret_access_key ${AWS_SECRET_ACCESS_KEY}
golish cloud config set providers.aws.region ap-southeast-1
golish cloud config set defaults.provider aws

# Step 2: SSH keys
golish cloud config set ssh.private_key_path ~/.ssh/id_rsa
golish cloud config set ssh.public_key_path ~/.ssh/id_rsa.pub

# Step 3: Clean the setup scripts first, then add setup commands for workers
golish cloud config set setup.commands.clear ""
golish cloud config set setup.commands.add "curl -fsSL https://raw.githubusercontent.com/ChristopherZh-7/golish-registry/main/install.sh | bash"
golish cloud config set setup.commands.add "golish install base --preset"

# Step 4: Run your first scan
golish cloud run -f fast -t example.com --auto-destroy
```

This provisions 1 AWS instance, installs golish + tools, runs the `fast` flow against `example.com`, streams output to your terminal, and destroys the instance when done.

### Verify Configuration

```bash
# View all settings
golish cloud config list

# View with secrets visible
golish cloud config list --show-secrets
```

## Workflow Mode Examples

### Single Target

```bash
# Run a flow
golish cloud run -f fast -t example.com

# Run a specific module
golish cloud run -m enum-subdomain -t example.com

# With timeout
golish cloud run -f general -t example.com --timeout 2h

# With specific provider
golish cloud run -f fast -t example.com --provider digitalocean
```

### Multiple Targets

```bash
# Distribute targets across 5 workers
golish cloud run -f fast -T targets.txt --instances 5

# 10 targets per worker (auto-calculates worker count)
golish cloud run -f fast -T targets.txt --instances 10 --chunk-size 10

# Split into exactly 3 chunks
golish cloud run -f fast -T targets.txt --instances 5 --chunk-count 3
```

### Full Lifecycle

```bash
# Provision, scan, sync results back, then destroy
golish cloud run -f fast -t example.com --sync-back --auto-destroy

# Same with multiple targets
golish cloud run -f fast -T targets.txt --instances 3 --sync-back --auto-destroy
```

### Reusing Infrastructure

```bash
# First run: provision and scan
golish cloud run -f fast -t target1.com

# Second run: reuse same instances for a different target
golish cloud run -f fast -t target2.com --reuse

# Reuse specific machines by IP
golish cloud run -f fast -t target3.com --reuse-with "1.2.3.4,5.6.7.8"

# When done, destroy manually
golish cloud destroy <infra-id>
```

## Custom Command Examples

### Basic Usage

```bash
# Run a single command
golish cloud run --custom-cmd "nmap -sV {{Target}}" -t example.com

# Run on existing infrastructure
golish cloud run --custom-cmd "whoami && id" -t example.com --reuse
```

### Recon Pipeline

```bash
# Subdomain enumeration → HTTP probing → screenshot
golish cloud run \
  --custom-cmd "subfinder -d {{Target}} -o /tmp/golish-custom/subs.txt" \
  --custom-cmd "cat /tmp/golish-custom/subs.txt | httpx -o /tmp/golish-custom/live.txt" \
  --custom-cmd "cat /tmp/golish-custom/live.txt | gowitness scan -o /tmp/golish-custom/screenshots" \
  --sync-path "/tmp/golish-custom/" \
  -t example.com --auto-destroy
```

### Vulnerability Scanning

```bash
# Nuclei scan with custom templates
golish cloud run \
  --custom-cmd "nuclei -u {{Target}} -t cves/ -o /tmp/golish-custom/cves.txt" \
  --custom-cmd "nuclei -u {{Target}} -t exposures/ -o /tmp/golish-custom/exposures.txt" \
  --custom-post-cmd "cat /tmp/golish-custom/cves.txt /tmp/golish-custom/exposures.txt | sort -u > /tmp/golish-custom/all-findings.txt" \
  --sync-path "/tmp/golish-custom/all-findings.txt" \
  -t example.com
```

### Port Scanning at Scale

```bash
# Distribute an IP list across 10 workers for masscan + nmap
golish cloud run \
  --custom-cmd "cat {{Target}} | while read ip; do masscan \$ip -p1-65535 --rate 1000 -oG /tmp/golish-custom/masscan-\$(echo \$ip | tr '.' '-').txt; done" \
  --custom-post-cmd "cat /tmp/golish-custom/masscan-*.txt > /tmp/golish-custom/all-ports.txt" \
  --sync-path "/tmp/golish-custom/" \
  -T ip-list.txt --instances 10 --auto-destroy
```

### SAST Scanning

```bash
# Clone a repo and run semgrep
golish cloud run \
  --custom-cmd "git clone https://github.com/org/repo.git /tmp/golish-custom/repo" \
  --custom-cmd "semgrep --config auto /tmp/golish-custom/repo --sarif -o /tmp/golish-custom/semgrep.sarif" \
  --sync-path "/tmp/golish-custom/semgrep.sarif" \
  -t org/repo --auto-destroy
```

### Custom Sync Destination

```bash
# Download to a specific local directory
golish cloud run \
  --custom-cmd "nmap -sV {{Target}} -oA /tmp/golish-custom/nmap" \
  --sync-path "/tmp/golish-custom/" \
  --sync-dest "./nmap-results" \
  -t example.com

# Results land in: ./nmap-results/<worker-name>-<ip>/tmp/golish-custom/nmap.*
```

### Using Worker Variables

```bash
# Log worker info alongside scan results
golish cloud run \
  --custom-cmd "echo 'Worker {{worker_name}} ({{public_ip}}) scanning {{Target}}' > /tmp/golish-custom/info.txt" \
  --custom-cmd "nmap -sV {{Target}} -oA /tmp/golish-custom/nmap" \
  --sync-path "/tmp/golish-custom/" \
  -t example.com
```

## Real-World Scenarios

### Bug Bounty: Enumerate Multiple Programs

```bash
# targets.txt contains: hackerone.com, bugcrowd.com, intigriti.com, ...
golish cloud run \
  -f general -T targets.txt --instances 5 \
  --sync-back --auto-destroy --provider digitalocean
```

### Scan a Large IP Range

```bash
# ip-ranges.txt contains CIDR ranges, one per line
golish cloud run \
  --custom-cmd "cat {{Target}} | nmap -iL - -sV -oA /tmp/golish-custom/scan" \
  --sync-path "/tmp/golish-custom/" \
  -T ip-ranges.txt --instances 10 --auto-destroy
```

### Persistent Campaign

```bash
# Create infrastructure once
golish cloud create --provider aws -n 3

# Run multiple scans over time
golish cloud run -f fast -t target1.com --reuse
golish cloud run -f fast -t target2.com --reuse
golish cloud run --custom-cmd "nuclei -u target3.com -o /tmp/golish-custom/nuclei.txt" \
  --sync-path "/tmp/golish-custom/" -t target3.com --reuse

# Destroy when the campaign is over
golish cloud destroy all --force
```

### Multi-Provider Strategy

```bash
# Use Hetzner for cheap bulk scanning
golish cloud run -f fast -T targets.txt --instances 10 --provider hetzner

# Use AWS for targets requiring specific geo-location
golish cloud run -f fast -t us-target.com --provider aws
```

## Provider Configuration Examples

### AWS

```bash
golish cloud config set providers.aws.access_key_id ${AWS_ACCESS_KEY_ID}
golish cloud config set providers.aws.secret_access_key ${AWS_SECRET_ACCESS_KEY}
golish cloud config set providers.aws.region ap-southeast-1
golish cloud config set providers.aws.instance_type t3.medium
golish cloud config set providers.aws.use_spot true
golish cloud config set defaults.provider aws
```

See [AWS Provider Guide](./cloud-provider-aws.md) for detailed setup and examples.

### Hetzner

```bash
golish cloud config set providers.hetzner.token ${HETZNER_API_TOKEN}
golish cloud config set providers.hetzner.location fsn1
golish cloud config set providers.hetzner.server_type cx22
golish cloud config set defaults.provider hetzner
```

See [Hetzner Provider Guide](./cloud-provider-hetzner.md) for detailed setup and examples.

### DigitalOcean

```bash
golish cloud config set providers.digitalocean.token ${DO_TOKEN}
golish cloud config set providers.digitalocean.region sgp1
golish cloud config set providers.digitalocean.size s-2vcpu-4gb
golish cloud config set defaults.provider digitalocean
```

### GCP

```bash
golish cloud config set providers.gcp.project_id ${GCP_PROJECT}
golish cloud config set providers.gcp.credentials_file /path/to/sa-key.json
golish cloud config set providers.gcp.region us-central1
golish cloud config set providers.gcp.zone us-central1-a
golish cloud config set providers.gcp.machine_type n1-standard-2
golish cloud config set providers.gcp.use_preemptible true
golish cloud config set defaults.provider gcp
```

### Linode

```bash
golish cloud config set providers.linode.token ${LINODE_TOKEN}
golish cloud config set providers.linode.region ap-south
golish cloud config set providers.linode.type g6-standard-2
golish cloud config set defaults.provider linode
```

### Azure

```bash
golish cloud config set providers.azure.subscription_id ${AZURE_SUB_ID}
golish cloud config set providers.azure.tenant_id ${AZURE_TENANT_ID}
golish cloud config set providers.azure.client_id ${AZURE_CLIENT_ID}
golish cloud config set providers.azure.client_secret ${AZURE_CLIENT_SECRET}
golish cloud config set providers.azure.location southeastasia
golish cloud config set providers.azure.vm_size Standard_B2s
golish cloud config set defaults.provider azure
```

## Advanced Topics

### Custom Snapshots

Pre-install tools on a VM, snapshot it, then use the snapshot for faster boot:

```bash
# 1. Create and set up a VM manually via your provider's console
# 2. Install golish + all tools
# 3. Create a snapshot/image in the provider console
# 4. Configure golish to use it

# AWS
golish cloud config set providers.aws.ami ami-0123456789abcdef0

# DigitalOcean
golish cloud config set providers.digitalocean.snapshot_id 12345678

# Hetzner
golish cloud config set providers.hetzner.image 12345678
```

Boot time drops from ~5 minutes to ~30 seconds.

### Custom Worker Setup

```bash
# Add setup commands (run in order on each worker)
golish cloud config set setup.commands.add "apt-get update && apt-get install -y nmap masscan"
golish cloud config set setup.commands.add "go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest"

# Add post-setup commands (with per-worker variable expansion)
golish cloud config set setup.post_commands.add "echo '{{worker_name}} at {{public_ip}}' >> /tmp/workers.txt"
```

### Ansible Setup

```bash
golish cloud config set setup.ansible.enabled true
golish cloud config set setup.ansible.playbook_path /path/to/setup.yaml
golish cloud run -f fast -t example.com --ansible
```

### Environment Variable Expansion

All config values support `${ENV_VAR}` syntax:

```bash
golish cloud config set providers.aws.access_key_id '${AWS_ACCESS_KEY_ID}'
golish cloud config set providers.aws.secret_access_key '${AWS_SECRET_ACCESS_KEY}'
```

Values are expanded at runtime from your shell environment.

## Troubleshooting

### Workers not connecting
```bash
golish cloud run -f fast -t example.com --verbose-setup  # See SSH output
golish cloud run -f fast -t example.com --debug          # Full debug logs
```

### Orphaned infrastructure
```bash
golish cloud list                    # Check what's running
golish cloud destroy all --force     # Emergency cleanup
```

### Cost limit exceeded
```bash
golish cloud config set limits.max_hourly_spend 5.00   # Increase limit
```

### Custom command failed
- Check if the tool is installed in your setup commands
- Use `--verbose-setup` to verify setup completed
- Test with a simple command first: `--custom-cmd "which nmap"`
