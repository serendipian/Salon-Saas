/**
 * Patch the global WebSocket constructor to log every Supabase realtime
 * connection's lifecycle: open, close (with code/reason/wasClean/lifetime),
 * and errors. The supabase-realtime-js client stores the underlying
 * WebSocket on a private property whose name varies between versions
 * (`conn`, `socket`, `transport`), so reaching it from the SDK is fragile.
 * Wrapping the global constructor catches every WS regardless of where the
 * SDK keeps it — and the URL filter avoids spamming non-realtime sockets
 * (Vite HMR, Sentry, etc.).
 *
 * Tagged `[realtime ws]` for easy filtering in DevTools console alongside
 * the existing `[realtime]` entries from useConnectionStatus.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;

// Match wss URLs that look like Supabase realtime endpoints. Supabase
// realtime URLs typically contain "/realtime/v1/websocket" — match on that
// fragment so we ignore other websockets (Vite HMR, third-party SDKs).
function isSupabaseRealtime(url: string): boolean {
  if (!url) return false;
  if (url.includes('/realtime/')) return true;
  // Fall back to project-host check in case path conventions change.
  if (SUPABASE_URL) {
    try {
      const projectHost = new URL(SUPABASE_URL).host;
      if (url.includes(projectHost)) return true;
    } catch {
      // ignore
    }
  }
  return false;
}

let installed = false;

export function installWebSocketDiagnostics(): void {
  if (installed) return;
  if (typeof window === 'undefined' || typeof window.WebSocket === 'undefined') return;

  const OriginalWebSocket = window.WebSocket;

  // Use a Proxy so the wrapped constructor still satisfies `instanceof WebSocket`
  // checks elsewhere in the app and preserves the original prototype chain.
  const PatchedWebSocket = new Proxy(OriginalWebSocket, {
    construct(target, args: ConstructorParameters<typeof WebSocket>) {
      const [url, protocols] = args;
      const urlStr = typeof url === 'string' ? url : url?.toString?.() ?? '';
      const ws = new target(url, protocols);

      if (isSupabaseRealtime(urlStr)) {
        const createdAt = Date.now();
        // Strip the access_token query param from the logged URL — it's a JWT
        // and we don't want it in the console for screenshots.
        const safeUrl = urlStr.replace(/(access_token=)[^&]+/, '$1<redacted>');
        // biome-ignore lint/suspicious/noConsole: diagnostic logger
        console.log(
          `[realtime ws] open.start ${JSON.stringify({
            url: safeUrl,
            at: new Date().toISOString(),
          })}`,
        );

        ws.addEventListener('open', () => {
          // biome-ignore lint/suspicious/noConsole: diagnostic logger
          console.log(
            `[realtime ws] open.ok ${JSON.stringify({
              elapsedMs: Date.now() - createdAt,
              at: new Date().toISOString(),
            })}`,
          );
        });

        ws.addEventListener('error', (event) => {
          // biome-ignore lint/suspicious/noConsole: diagnostic logger
          console.log(
            `[realtime ws] error ${JSON.stringify({
              elapsedMs: Date.now() - createdAt,
              type: event.type,
              at: new Date().toISOString(),
            })}`,
          );
        });

        ws.addEventListener('close', (event: CloseEvent) => {
          // biome-ignore lint/suspicious/noConsole: diagnostic logger
          console.log(
            `[realtime ws] close ${JSON.stringify({
              code: event.code,
              reason: event.reason || null,
              wasClean: event.wasClean,
              lifetimeMs: Date.now() - createdAt,
              at: new Date().toISOString(),
            })}`,
          );
        });
      }

      return ws;
    },
  });

  // Replace the global constructor. Code that does `new WebSocket(...)` now
  // goes through the proxy. `WebSocket.OPEN`, `WebSocket.CLOSED`, etc. are
  // still accessible because the proxy preserves get-trap defaults.
  // biome-ignore lint/suspicious/noExplicitAny: replacing a built-in for diagnostics
  (window as any).WebSocket = PatchedWebSocket;
  installed = true;
}
