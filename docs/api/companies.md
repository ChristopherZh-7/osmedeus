---
title: "Companies"
description: "Create evidence-backed company profiles and authorize asset scope"
---

# Companies API

The company intake API separates legal identity, ownership evidence, and scan
authorization:

```
company name -> draft company profile -> passive candidates -> operator confirmation
             -> org -> authorized root-domain workspaces -> optional scan
```

Creating a draft never creates an org, workspace, asset, or run. Confirming a
company creates or reuses an org and creates workspaces only for the submitted
root domains. Passive-provider candidates are imported into `assets` only after
a separate authorization request.

## Create a draft

```bash
curl -X POST http://localhost:8002/golish/api/companies/intake \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Acme",
    "canonical_name": "Acme Technology Co., Ltd.",
    "official_website": "https://www.acme.example",
    "unified_credit_code": "operator-supplied-evidence",
    "domains": ["acme.example"]
  }'
```

The response includes `name_resolution.status=needs_confirmation`. Golish
does not infer a legal company name from an LLM response alone.

## Run passive discovery

```bash
curl -X POST http://localhost:8002/golish/api/companies/<company-uuid>/discover
```

Configured FOFA, Quake, Hunter and 0.zone providers are queried. Discovery uses
both the confirmed/declared domain roots and bounded company identity hints
(legal name, input name and aliases). Missing keys are reported as
`configured: false` and do not fail the request. Results remain company
candidates and do not start network probes.

Each candidate includes explainable attribution fields:

- `confidence` and `attribution_status` (`strong`, `probable`, `weak`, or
  `unverified`)
- `attribution_reasons`, containing the evidence that changed the score
- `matched_root_domain`, when the hostname is under a known company root
- `infrastructure_type` and `shared_infrastructure`, distinguishing hostnames,
  associated IPs, possible dedicated IPs, and CDN/cloud/shared addresses
- `authorization_eligible`, which becomes true only after the company is
  confirmed and the candidate is inside an approved root-domain scope

A company-name, title, certificate, or mapping-platform hit is discovery
evidence, not scan authorization. A shared CDN/cloud IP is never treated as a
company-owned IP merely because it currently serves a company hostname.

## Confirm identity and authorized root domains

```bash
curl -X POST http://localhost:8002/golish/api/companies/<company-uuid>/confirm \
  -H 'Content-Type: application/json' \
  -d '{
    "canonical_name": "Acme Technology Co., Ltd.",
    "domains": ["acme.example"]
  }'
```

The response explicitly returns `scan_started: false`. Start the grouped
company workflow separately by passing the confirmed company UUID to the Runs
API:

```bash
curl -X POST http://localhost:8002/golish/api/runs \
  -H 'Content-Type: application/json' \
  -d '{
    "flow": "company-recon",
    "target": "<company-uuid>",
    "concurrency": 2,
    "params": {"profile": "standard"}
  }'
```

`company-recon` accepts `lite`, `standard`, or `extensive`. The API expands
only `authorization_status=approved` root domains, starts one `domain-recon`
run per domain/workspace, and attaches the company `org_uuid`, `company_uuid`,
and a shared job ID to every child run. Pending domains and passive-provider
candidates are never included.

Calling the confirmation endpoint again with all existing approved roots plus
newly selected candidate roots expands the same company org with the new
workspaces. It does not create a second org and still does not start a scan.

## Authorize passive candidates

```bash
curl -X POST http://localhost:8002/golish/api/companies/<company-uuid>/candidates/authorize \
  -H 'Content-Type: application/json' \
  -d '{"candidate_ids": [12, 13]}'
```

Every selected candidate must be the authorized root domain or one of its
subdomains. The request is transactional: one out-of-scope candidate rejects
the whole selection.
