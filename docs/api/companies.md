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
curl -X POST http://localhost:8002/osm/api/companies/intake \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Acme",
    "canonical_name": "Acme Technology Co., Ltd.",
    "official_website": "https://www.acme.example",
    "unified_credit_code": "operator-supplied-evidence",
    "domains": ["acme.example"]
  }'
```

The response includes `name_resolution.status=needs_confirmation`. Osmedeus
does not infer a legal company name from an LLM response alone.

## Run passive discovery

```bash
curl -X POST http://localhost:8002/osm/api/companies/<company-uuid>/discover
```

Configured FOFA, Quake, Hunter and 0.zone providers are queried. Missing keys
are reported as `configured: false` and do not fail the request. Results remain
company candidates and do not start network probes.

## Confirm identity and authorized root domains

```bash
curl -X POST http://localhost:8002/osm/api/companies/<company-uuid>/confirm \
  -H 'Content-Type: application/json' \
  -d '{
    "canonical_name": "Acme Technology Co., Ltd.",
    "domains": ["acme.example"]
  }'
```

The response explicitly returns `scan_started: false`. Run the authorized
workflow separately:

```bash
osmedeus run -f company-recon-full -t acme.example --org 'Acme Technology Co., Ltd.'
```

## Authorize passive candidates

```bash
curl -X POST http://localhost:8002/osm/api/companies/<company-uuid>/candidates/authorize \
  -H 'Content-Type: application/json' \
  -d '{"candidate_ids": [12, 13]}'
```

Every selected candidate must be the authorized root domain or one of its
subdomains. The request is transactional: one out-of-scope candidate rejects
the whole selection.
