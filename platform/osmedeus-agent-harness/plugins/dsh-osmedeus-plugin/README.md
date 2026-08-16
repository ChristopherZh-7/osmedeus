# Osmedeus DSH Plugin

This package is the compatibility boundary between Osmedeus and DeepSeek
Harness. It does not replace the native DSH Workspace or Session services.

The client capability opens a native session named by the `osmSession` query
parameter after DSH has loaded its Session baseline. The host capability
accepts a bounded reconnaissance envelope from Osmedeus and materializes it at
`$DSH_HOME/osmedeus/scopes/$DSH_SESSION_ID/context.json`. Assets, Skills, scoped
tools, and future finding submission capabilities stay behind this package.
