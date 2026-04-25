/**
 * Patch the global WebSocket constructor to log every Supabase realtime
 * connection's full lifecycle: open, close (with code/reason/wasClean/
 * lifetime), errors, AND every phoenix protocol frame in both directions.
 *
 * The supabase-realtime-js client stores the underlying WebSocket on a
 * private property whose name varies between versions (`conn`, `socket`,
 * `transport`), so reaching it from the SDK is fragile. Wrapping the
 * global constructor catches every WS regardless of where the SDK keeps
 * it — and the URL filter avoids spamming non-realtime sockets (Vite HMR,
 * Sentry, etc.).
 *
 * Phoenix v2 wire format is a JSON array:
 *   [join_ref, ref, topic, event, payload]
 * Common events: phx_join, phx_reply, phx_close, phx_error, heartbeat,
 * presence_state, etc. We pretty-print event + payload status; full
 * payload is included for non-heartbeat frames so we can see the close
 * reason the server sends when it rejects a join.
 *
 * Tagged `[realtime ws]` for easy filtering in DevTools console alongside
 * the existing `[realtime]` entries from useConnectionStatus.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;

// Match wss URLs that look like Supabase realtime endpoints.
function isSupabaseRealtime(url: string): boolean {
  if (!url) return false;
  if (url.includes('/realtime/')) return true;
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

/**
 * Phoenix v2 frame: [joinRef, ref, topic, event, payload]. The library
 * sends arrays as JSON strings on the wire. We try to parse and extract
 * the parts we care about; on parse failure we fall back to the raw text.
 */
function parsePhxFrame(raw: unknown): {
  joinRef: string | null;
  ref: string | null;
  topic: string;
  event: string;
  payload: unknown;
} | null {
  if (typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length < 5) return null;
    return {
      joinRef: parsed[0] ?? null,
      ref: parsed[1] ?? null,
      topic: String(parsed[2] ?? ''),
      event: String(parsed[3] ?? ''),
      payload: parsed[4],
    };
  } catch {
    return null;
  }
}

// Heartbeats are sent every 30s in both directions and create noise.
// Skip them in the per-frame log; their absence is a useful signal too
// (we'll still notice if heartbeats stop firing).
function shouldLogFrame(event: string): boolean {
  return event !== 'heartbeat';
}

let installed = false;

export function installWebSocketDiagnostics(): void {
  if (installed) return;
  if (typeof window === 'undefined' || typeof window.WebSocket === 'undefined') return;

  const OriginalWebSocket = window.WebSocket;

  const PatchedWebSocket = new Proxy(OriginalWebSocket, {
    construct(target, args: ConstructorParameters<typeof WebSocket>) {
      const [url, protocols] = args;
      const urlStr = typeof url === 'string' ? url : url?.toString?.() ?? '';
      const ws = new target(url, protocols);

      if (isSupabaseRealtime(urlStr)) {
        const createdAt = Date.now();
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

        // Log every received phoenix frame.
        ws.addEventListener('message', (event: MessageEvent) => {
          const frame = parsePhxFrame(event.data);
          if (!frame) {
            // Non-JSON or unexpected shape — log a small preview for awareness.
            const preview =
              typeof event.data === 'string' ? event.data.slice(0, 120) : '<binary>';
            // biome-ignore lint/suspicious/noConsole: diagnostic logger
            console.log(`[realtime ws] recv.raw ${JSON.stringify({ preview })}`);
            return;
          }
          if (!shouldLogFrame(frame.event)) return;
          // biome-ignore lint/suspicious/noConsole: diagnostic logger
          console.log(
            `[realtime ws] recv ${JSON.stringify({
              topic: frame.topic,
              event: frame.event,
              ref: frame.ref,
              joinRef: frame.joinRef,
              payload: frame.payload,
              elapsedMs: Date.now() - createdAt,
            })}`,
          );
        });

        // Log every sent phoenix frame by wrapping send().
        const originalSend = ws.send.bind(ws);
        ws.send = (data: string | ArrayBufferLike | Blob | ArrayBufferView) => {
          const frame = parsePhxFrame(data);
          if (frame && shouldLogFrame(frame.event)) {
            // biome-ignore lint/suspicious/noConsole: diagnostic logger
            console.log(
              `[realtime ws] send ${JSON.stringify({
                topic: frame.topic,
                event: frame.event,
                ref: frame.ref,
                joinRef: frame.joinRef,
                payload: frame.payload,
                elapsedMs: Date.now() - createdAt,
              })}`,
            );
          } else if (!frame && typeof data === 'string') {
            const preview = data.slice(0, 120);
            // biome-ignore lint/suspicious/noConsole: diagnostic logger
            console.log(`[realtime ws] send.raw ${JSON.stringify({ preview })}`);
          }
          return originalSend(data);
        };
      }

      return ws;
    },
  });

  // biome-ignore lint/suspicious/noExplicitAny: replacing a built-in for diagnostics
  (window as any).WebSocket = PatchedWebSocket;
  installed = true;
}
