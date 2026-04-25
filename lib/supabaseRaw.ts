/**
 * Raw-fetch escape hatch for PostgREST reads + RPC calls.
 *
 * Reason we need this: supabase-js serializes auth operations through an
 * internal lock. After Chrome's background-tab throttling pauses an in-flight
 * refresh, that lock can stay held across idle — every subsequent SDK call
 * then queues on it and hangs until a full page reload. CLAUDE.md already
 * documents this for getUser/signOut/updateUser; the same class of hang
 * affects every `.from(...).select(...)` and `.rpc(...)` after idle.
 *
 * This module bypasses the SDK entirely: reads the access_token straight from
 * localStorage and issues raw fetches. No lock contention, no in-memory state
 * to go stale — as long as the network is up and the token isn't expired,
 * these work regardless of what the SDK is doing.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const PROJECT_REF = SUPABASE_URL.match(/https:\/\/([^.]+)\./)?.[1];
const STORAGE_KEY = PROJECT_REF ? `sb-${PROJECT_REF}-auth-token` : null;

function getAccessToken(): string | null {
  if (!STORAGE_KEY) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { access_token?: string };
    return parsed.access_token ?? null;
  } catch {
    return null;
  }
}

interface SupabaseLikeError extends Error {
  code?: string;
  status?: number;
  details?: string;
  hint?: string;
}

function buildError(
  message: string,
  code?: string,
  status?: number,
  details?: string,
  hint?: string,
): SupabaseLikeError {
  const err = new Error(message) as SupabaseLikeError;
  if (code) err.code = code;
  if (status !== undefined) err.status = status;
  if (details) err.details = details;
  if (hint) err.hint = hint;
  return err;
}

async function throwFromResponse(response: Response): Promise<never> {
  let message = `HTTP ${response.status}`;
  let code: string | undefined;
  let details: string | undefined;
  let hint: string | undefined;
  try {
    const body = (await response.json()) as {
      message?: string;
      code?: string;
      details?: string;
      hint?: string;
    };
    if (body.message) message = body.message;
    code = body.code;
    details = body.details;
    hint = body.hint;
  } catch {
    // non-JSON body — keep HTTP status as message
  }
  throw buildError(message, code, response.status, details, hint);
}

async function sendRequest(path: string, init: RequestInit): Promise<Response> {
  const token = getAccessToken();
  if (!token) throw buildError('Session introuvable, veuillez vous reconnecter.');

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) await throwFromResponse(response);
  return response;
}

/**
 * Raw-fetch a PostgREST SELECT. `params` is the fully-formed query string
 * (no leading `?`), e.g. "select=*&salon_id=eq.xxx&order=date.desc".
 */
export async function rawSelect<T>(
  table: string,
  params: string,
  signal?: AbortSignal,
): Promise<T[]> {
  const response = await sendRequest(`${table}?${params}`, { method: 'GET', signal });
  return response.json() as Promise<T[]>;
}

/**
 * Raw-fetch a PostgREST RPC call. Returns the parsed JSON response (or null
 * for empty bodies, matching void-returning Postgres functions).
 */
export async function rawRpc<T>(
  fnName: string,
  payload: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await sendRequest(`rpc/${fnName}`, {
    method: 'POST',
    body: JSON.stringify(payload),
    signal,
  });
  const text = await response.text();
  return text ? (JSON.parse(text) as T) : (null as T);
}

/**
 * Raw-fetch a PostgREST INSERT. Sends `Prefer: return=minimal` so the
 * server skips returning the inserted row — matches `supabase.from(t).insert(...)`
 * without a trailing `.select()`. Body may be a single object or an array.
 */
export async function rawInsert(
  table: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<void> {
  await sendRequest(table, {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(body),
    signal,
  });
}

/**
 * Raw-fetch a PostgREST UPDATE. `params` is the fully-formed filter query
 * string (no leading `?`), e.g. "id=eq.xxx&salon_id=eq.yyy". Returns void;
 * matches `supabase.from(t).update(...).eq(...)` without `.select()`.
 */
export async function rawUpdate(
  table: string,
  params: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<void> {
  await sendRequest(`${table}?${params}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(body),
    signal,
  });
}
