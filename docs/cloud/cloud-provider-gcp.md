# GCP Provider Guide

Step-by-step guide for running golish cloud on Google Cloud Platform Compute Engine instances.

## Prerequisites

- A GCP account with a project
- A service account with Compute Engine permissions
- A service account key file (JSON)
- An SSH key pair (local `~/.ssh/id_rsa` and `~/.ssh/id_rsa.pub`)

### Required IAM Permissions

The service account needs these roles (or use the `Compute Admin` role):

```
compute.instances.create
compute.instances.delete
compute.instances.get
compute.instances.list
compute.instances.setMetadata
compute.firewalls.create
compute.firewalls.delete
compute.firewalls.get
compute.networks.get
compute.subnetworks.use
compute.disks.create
compute.images.get
compute.images.useReadOnly
```

The simplest approach is to assign the **Compute Admin** (`roles/compute.admin`) role to your service account.

### Create a Service Account and Key

1. Go to **IAM & Admin** > **Service Accounts** > **Create Service Account**
2. Name it `golish-cloud` (or similar)
3. Grant it the **Compute Admin** role
4. Go to the service account > **Keys** > **Add Key** > **Create new key** > **JSON**
5. Save the JSON file (e.g., `~/.gcp/golish-sa.json`)

Or via `gcloud` CLI:

```bash
# Create service account
gcloud iam service-accounts create golish-cloud \
  --display-name="Golish Cloud Scanner"

# Grant Compute Admin role
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:golish-cloud@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/compute.admin"

# Create and download key file
gcloud iam service-accounts keys create ~/.gcp/golish-sa.json \
  --iam-account=golish-cloud@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

You can also export the credentials file path as an environment variable:

```bash
export GCP_PROJECT_ID=your-project-id
export GCP_CREDENTIALS_FILE=~/.gcp/golish-sa.json
```

## Configuration

### Minimal Setup

```bash
# Enable cloud feature
golish config set cloud.enabled true

# Credentials
golish cloud config set providers.gcp.project_id ${GCP_PROJECT_ID}
golish cloud config set providers.gcp.credentials_file ${GCP_CREDENTIALS_FILE}
golish cloud config set providers.gcp.region us-central1
golish cloud config set providers.gcp.zone us-central1-a
golish cloud config set defaults.provider gcp

# SSH
golish cloud config set ssh.private_key_path ~/.ssh/id_rsa
golish cloud config set ssh.public_key_path ~/.ssh/id_rsa.pub
golish cloud config set ssh.user root

# Clean the setup scripts first
golish cloud config set setup.commands.clear ""

# Worker setup
golish cloud config set setup.commands.add "sudo apt-get update"
golish cloud config set setup.commands.add "sudo apt-get install -y -qq curl git tmux unzip jq rsync"
golish cloud config set setup.commands.add "curl -fsSL https://raw.githubusercontent.com/ChristopherZh-7/golish-registry/main/install.sh | bash"
golish cloud config set setup.commands.add "golish install base --preset"
```

### Machine Types

| Machine Type | vCPU | RAM | $/hr (on-demand) | $/hr (preemptible, ~80% off) | Best For |
|-------------|------|-----|------|------|----------|
| e2-medium | 2 | 4 GB | $0.0335 | ~$0.010 | Light scans, single targets |
| n1-standard-2 | 2 | 7.5 GB | $0.0950 | ~$0.019 | General scanning (default) |
| n1-standard-4 | 4 | 15 GB | $0.1900 | ~$0.038 | Heavy scans, large target lists |
| n2-standard-2 | 2 | 8 GB | $0.0971 | ~$0.019 | General scanning (newer gen) |
| n2-standard-4 | 4 | 16 GB | $0.1942 | ~$0.039 | Parallel pipelines |
| c2-standard-4 | 4 | 16 GB | $0.2088 | ~$0.042 | CPU-intensive scans |

```bash
# Set machine type
golish cloud config set providers.gcp.machine_type n1-standard-2
```

### Preemptible Instances

Preemptible VMs cost up to 80% less than on-demand. They last at most 24 hours and can be reclaimed, but are ideal for security scanning workloads.

```bash
golish cloud config set providers.gcp.use_preemptible true
```

### Regions and Zones

Pick a region close to your targets or with the lowest pricing:

| Region | Location | Code | Zone Example |
|--------|----------|------|-------------|
| Iowa | US | `us-central1` | `us-central1-a` |
| South Carolina | US | `us-east1` | `us-east1-b` |
| Oregon | US | `us-west1` | `us-west1-b` |
| Frankfurt | Europe | `europe-west3` | `europe-west3-a` |
| London | Europe | `europe-west2` | `europe-west2-a` |
| Singapore | Asia | `asia-southeast1` | `asia-southeast1-a` |
| Tokyo | Asia | `asia-northeast1` | `asia-northeast1-a` |
| Mumbai | Asia | `asia-south1` | `asia-south1-a` |
| Sydney | Australia | `australia-southeast1` | `australia-southeast1-a` |

```bash
golish cloud config set providers.gcp.region us-central1
golish cloud config set providers.gcp.zone us-central1-a
```

> **Note:** The zone must be within the selected region.

### Custom Image Family

Use a custom image family with tools pre-installed for faster startup:

```bash
# Default is ubuntu-2204-lts from the ubuntu-os-cloud project
# Use your own custom image family if you have one
golish cloud config set providers.gcp.image_family my-golish-image
```

### Cost Limits

```bash
golish cloud config set limits.max_hourly_spend 1.00
golish cloud config set limits.max_total_spend 10.00
golish cloud config set limits.max_instances 10
```

## Examples

### Quick Domain Recon

```bash
golish cloud run -f fast -t example.com --auto-destroy
```

Cost: ~$0.03 (1 x e2-medium x 1 hour)

### Large-Scale Subdomain Enumeration

```bash
# targets.txt: one domain per line
golish cloud run -f general -T targets.txt --instances 5 --sync-back --auto-destroy
```

Cost: ~$0.48 (5 x n1-standard-2 x 1 hour)

### Custom Nmap Scan

```bash
golish cloud run \
  --custom-cmd "nmap -sV -sC {{Target}} -oA /tmp/golish-custom/nmap" \
  --sync-path "/tmp/golish-custom/" \
  -t example.com --auto-destroy
```

### Distributed Nuclei Scanning

```bash
golish cloud run \
  --custom-cmd "cat {{Target}} | nuclei -o /tmp/golish-custom/results.txt" \
  --sync-path "/tmp/golish-custom/results.txt" \
  --sync-dest "./nuclei-gcp" \
  -T urls.txt --instances 10 --auto-destroy
```

Cost: ~$0.34 (10 x e2-medium x 1 hour)

### Preemptible Instance Pipeline

```bash
# Configure preemptible
golish cloud config set providers.gcp.use_preemptible true
golish cloud config set providers.gcp.machine_type n1-standard-2

# Run a heavy scan for cheap
golish cloud run \
  --custom-cmd "subfinder -d {{Target}} -all -o /tmp/golish-custom/subs.txt" \
  --custom-cmd "cat /tmp/golish-custom/subs.txt | httpx -td -o /tmp/golish-custom/live.txt" \
  --custom-cmd "cat /tmp/golish-custom/live.txt | nuclei -o /tmp/golish-custom/nuclei.txt" \
  --sync-path "/tmp/golish-custom/" \
  -t example.com --auto-destroy
```

Cost: ~$0.019 (1 x n1-standard-2 preemptible x 1 hour)

### Persistent Recon Campaign

```bash
# Create instances once (saves setup time on subsequent runs)
golish cloud create --provider gcp -n 3

# Run scans throughout the day
golish cloud run -f fast -t target1.com --reuse
golish cloud run -f fast -t target2.com --reuse
golish cloud run --custom-cmd "nuclei -u target3.com -o /tmp/golish-custom/nuclei.txt" \
  --sync-path "/tmp/golish-custom/" -t target3.com --reuse

# Destroy at end of day
golish cloud destroy all --force
```

### Multi-Region Scanning

```bash
# Scan US targets from Iowa
golish cloud config set providers.gcp.region us-central1
golish cloud config set providers.gcp.zone us-central1-a
golish cloud run -f fast -t us-company.com --auto-destroy

# Scan APAC targets from Singapore
golish cloud config set providers.gcp.region asia-southeast1
golish cloud config set providers.gcp.zone asia-southeast1-a
golish cloud run -f fast -t apac-company.com --auto-destroy
```

## Troubleshooting

### "Permission denied" or "403 Forbidden"

Your service account lacks required permissions. Assign the **Compute Admin** role:

```bash
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_SA@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/compute.admin"
```

### "Credentials file not found"

Make sure the JSON key file path is correct and the file exists:

```bash
# Check the file exists
ls -la ~/.gcp/golish-sa.json

# Or set via environment variable
export GCP_CREDENTIALS_FILE=/absolute/path/to/key.json
golish cloud config set providers.gcp.credentials_file ${GCP_CREDENTIALS_FILE}
```

### Instances Not Starting

```bash
# Check with debug output
golish cloud run -f fast -t example.com --debug

# Common causes:
# - Quota exceeded (check Quotas page in Cloud Console)
# - Zone doesn't have the machine type available
# - Compute Engine API not enabled (enable it in APIs & Services)
# - Preemptible capacity unavailable (try a different zone or on-demand)
```

### "Compute Engine API has not been used" Error

Enable the Compute Engine API for your project:

```bash
gcloud services enable compute.googleapis.com --project=YOUR_PROJECT_ID
```

### SSH Connection Timeout

```bash
# Verify firewall rule allows SSH (port 22)
gcloud compute firewall-rules list --filter="name~golish"

# Check with verbose setup
golish cloud run -f fast -t example.com --verbose-setup
```

### Preemptible Instance Terminated

Preemptible VMs are reclaimed after 24 hours or when GCP needs capacity. The scan will fail for that worker. Mitigation:

- Use `--auto-destroy` to clean up
- Re-run the failed targets
- Use on-demand instances for critical or long-running scans

### Cleaning Up

```bash
# List all infrastructure
golish cloud list

# Destroy specific
golish cloud destroy <infra-id>

# Nuclear option
golish cloud destroy all --force

# If golish state is out of sync, check GCP console directly:
# Compute Engine > VM Instances > filter by label "golish"
# Or via gcloud:
gcloud compute instances list --filter="labels.golish:*"
```

## Cost Optimization

1. **Use preemptible instances** for all non-critical scans (`use_preemptible: true`) — up to 80% savings
2. **Right-size machines**: e2-medium is enough for most single-target scans
3. **Always use `--auto-destroy`** to prevent forgotten instances
4. **Set cost limits** to catch runaway spending
5. **Use custom images** to reduce setup time (less instance-hours)
6. **Pick the cheapest region** if target geo-location doesn't matter (us-central1 is usually cheapest)
7. **GCP sustained-use discounts** apply automatically for on-demand VMs running more than 25% of the month
