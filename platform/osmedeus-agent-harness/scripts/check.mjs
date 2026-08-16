import { harnessURL, installedDSHManifest } from "./runtime.mjs";

const baseURL = harnessURL();
const startedAt = performance.now();

try {
  const response = await fetch(`${baseURL}/`, {
    headers: { accept: "text/html" },
    signal: AbortSignal.timeout(5000),
  });
  const body = await response.text();
  const compatible = response.ok && body.includes("window.__DSH_BOOT__");

  const result = {
    status: compatible ? "ready" : "incompatible",
    connected: response.ok,
    compatible,
    provider: "deepseek-harness",
    version: installedDSHManifest().version,
    url: baseURL,
    latency_ms: Math.round(performance.now() - startedAt),
  };

  console.log(JSON.stringify(result, null, 2));
  if (!compatible) {
    process.exitCode = 1;
  }
} catch (error) {
  console.error(
    JSON.stringify(
      {
        status: "unavailable",
        connected: false,
        compatible: false,
        provider: "deepseek-harness",
        version: installedDSHManifest().version,
        url: baseURL,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
}
