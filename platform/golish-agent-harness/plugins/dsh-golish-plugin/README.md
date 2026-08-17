# Golish DSH Plugin

This package is the compatibility boundary between Golish and DeepSeek
Harness. It does not replace the native DSH Workspace or Session services.

The client capability opens a native session named by the `golishSession` query
parameter after DSH has loaded its Session baseline. The host capability
accepts a bounded reconnaissance envelope from Golish and materializes it at
`$DSH_HOME/golish/scopes/$DSH_SESSION_ID/context.json`. Assets, Skills, scoped
tools, and future finding submission capabilities stay behind this package.
