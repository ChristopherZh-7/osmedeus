# Osmedeus DSH Skills

These bundles are installed into `$DSH_HOME/skills` by `scripts/start.mjs`, the
official user-level discovery root used by DeepSeek Harness. DSH core packages
are not modified.

- `osmedeus-pentest` is the mandatory scope and reconnaissance entry point.
- `cyberstrike-*` bundles are curated from the top-level Skills in
  `CyberStrike-main/.cyberstrike/skill`.
- Deeply nested CIS, NIST, MITRE, and OWASP atomic libraries are intentionally
  not copied into the active catalog. DSH discovers one level and a 7,000+
  entry catalog would add substantial prompt noise. The separate CyberStrike
  library under `$DSH_HOME/osmedeus/cyberstrike-skills` is indexed recursively
  by the Osmedeus orchestrator and queried lazily through `pentagi_skill`.
- CyberStrike's `bun-file-io` bundle is excluded because it documents
  CyberStrike repository development rather than penetration testing.

Imported bundles retain their upstream body and carry an Osmedeus adaptation
notice: target scope comes from `osmedeus-pentest`, named CyberStrike-only tools
must be checked before use, and high-impact actions need operator approval.
