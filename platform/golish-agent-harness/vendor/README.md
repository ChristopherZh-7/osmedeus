# Bundled CyberStrike Skill corpus

This directory vendors the complete `.cyberstrike/skill` tree from
CyberStrike `v1.1.14` at commit
`60fd0c43110d5b86ef56cfa7317faf80c6264ce8`.

`methodology-source.json` records the immutable source and expected index
counts. `CYBERSTRIKE-LICENSE` is the upstream license. The corpus stays outside
DSH's active one-level Skill catalog and is searched and loaded lazily through
the Golish `pentagi_skill` tool.

To update the corpus, replace `methodology-skills/` from the upstream
`.cyberstrike/skill` directory, update the source manifest, and run:

```bash
cd platform/golish-agent-harness
npm run verify:install
npm test
```
