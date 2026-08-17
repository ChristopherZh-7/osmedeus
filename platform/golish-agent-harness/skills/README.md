# Golish DSH Skills

These bundles are installed into `$DSH_HOME/skills` by `scripts/start.mjs`, the
official user-level discovery root used by DeepSeek Harness. DSH core packages
are not modified.

- `golish-pentest` is the mandatory scope and reconnaissance entry point.
- Curated top-level bundles use direct names such as `attack-ssrf` and
  `cloud-assessment`, without a provider prefix.
- Deeply nested CIS, NIST, MITRE, and OWASP atomic libraries are intentionally
  not copied into the active catalog. DSH discovers one level and a 7,000+
  entry catalog would add substantial prompt noise. The complete bundled
  methodology library under `vendor/methodology-skills` is indexed recursively
  by the Golish orchestrator and queried lazily through `pentagi_skill`.
- The upstream `bun-file-io` bundle is excluded because it documents provider
  repository development rather than penetration testing.

Imported bundles retain their upstream body and carry a Golish adaptation
notice: target scope comes from `golish-pentest`, named upstream-only tools
must be checked before use, and high-impact actions need operator approval.
Source attribution and license details remain in `vendor/README.md`.
