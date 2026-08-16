window.__ModuleLoader__.load({
  id: "@osmedeus/dsh-plugin",
  factory: () => {
    const module = { exports: {} };
    const exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const SESSION_QUERY_KEY = "osmSession";
    const inject = ["sessions"];

    /**
     * Open the native DSH Session selected by Osmedeus once the reconnect
     * baseline contains it. Session state remains owned by DSH; this adapter
     * only provides the stable deep link used by the embedded Osmedeus page.
     */
    function apply(ctx) {
      const location = globalThis.location;
      if (location === undefined) return;

      const sessionId = new URLSearchParams(location.search)
        .get(SESSION_QUERY_KEY)
        ?.trim();
      if (!sessionId) return;

      ctx.effect(() => {
        let opened = false;
        const reconcile = () => {
          if (opened) return;
          const snapshot = ctx.sessions.list.getSnapshot();
          if (snapshot.byId[sessionId] === undefined) return;
          opened = true;
          ctx.sessions.open(sessionId);
        };
        const unsubscribe = ctx.sessions.list.subscribe(reconcile);
        reconcile();
        return unsubscribe;
      }, "osmedeus: open mapped session");
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
