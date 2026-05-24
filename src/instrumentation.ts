// Shared across the Node server process so route handlers (e.g. /api/health)
// can read the same boot identity and start time that register() recorded.
declare global {
  // eslint-disable-next-line no-var
  var __BOOT__:
    | { id: string; startedAt: number; firstHealthLogged: boolean }
    | undefined;
}

const ts = (): string => new Date().toISOString();

/**
 * Runs once when the server process starts (Next's stable instrumentation hook).
 * Diagnostic-only: records boot identity/timing and observes process lifecycle
 * so 502 bursts can be correlated to a specific container instance and to
 * restarts vs. steady-state. Does not alter request handling.
 */
export function register(): void {
  // register() also runs in the edge runtime (for middleware); the process-level
  // handlers below only apply to the long-lived Node server process.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Reuse BOOT_ID from docker-entrypoint.sh so the entrypoint and Node logs
  // share one id; fall back to a fresh nonce for local/non-Docker runs.
  // Web Crypto global works in both the Node and edge runtimes (a top-level
  // `node:crypto` import would break the edge bundle that middleware loads).
  const id = process.env.BOOT_ID ?? crypto.randomUUID().slice(0, 8);
  process.env.BOOT_ID = id;
  globalThis.__BOOT__ = { id, startedAt: Date.now(), firstHealthLogged: false };

  console.log(`[boot] node start boot_id=${id} at=${ts()} pid=${process.pid}`);

  process.on("SIGTERM", () => {
    // Platform-initiated shutdown (redeploy / host migration) sends SIGTERM.
    // A crash sends nothing — so the presence/absence of this line is the
    // graceful-vs-crash signal. We only observe: Next's standalone server
    // registers its own SIGTERM handler that closes the HTTP server and exits,
    // so shutdown timing is unchanged.
    console.log(`[boot] received SIGTERM, draining boot_id=${id} at=${ts()}`);
  });

  process.on("uncaughtException", (err) => {
    logFatal("uncaughtException", err, id);
    process.exit(1); // preserve Node's default crash-then-restart semantics
  });

  process.on("unhandledRejection", (reason) => {
    logFatal("unhandledRejection", reason, id);
    process.exit(1); // Node 22 terminates on unhandled rejection by default
  });
}

function logFatal(kind: string, err: unknown, id: string): void {
  const e = err instanceof Error ? err : new Error(String(err));
  const code = (e as NodeJS.ErrnoException).code ?? "";
  console.error(
    `[boot] ${kind} boot_id=${id} at=${ts()} code=${code} name=${e.name} message=${e.message}`,
  );
  console.error(e.stack ?? "(no stack)");
}

/**
 * Next calls this after a server-side error, with request context. This is
 * where `Error: aborted` / ECONNRESET surface, so we tag them and attach the
 * method + path to reveal whether resets cluster on one endpoint or spray
 * across all routes.
 */
export function onRequestError(
  err: unknown,
  request: { path?: string; method?: string },
): void {
  const id = globalThis.__BOOT__?.id ?? process.env.BOOT_ID ?? "unknown";
  const e = err instanceof Error ? err : new Error(String(err));
  const code = (e as NodeJS.ErrnoException).code ?? "";
  const aborted = code === "ECONNRESET" || /aborted/i.test(e.message);
  console.error(
    `[req-err] ${aborted ? "conn-reset" : "error"} boot_id=${id} ` +
      `method=${request.method ?? "?"} path=${request.path ?? "?"} ` +
      `code=${code} message=${e.message}`,
  );
}
