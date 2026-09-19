/** One way to send a form to the site's own API, with the failure sorted into
 *  what the caller does with it: show the server's message, or the network
 *  one.  Client-safe: no React, nothing server-only. */

/** invalid: the server refused what was sent (4xx); server: it failed (5xx). */
export type PostFailure = "invalid" | "rate_limited" | "server" | "network";

export type PostResult =
  | { ok: true }
  | { ok: false; error: string; kind: PostFailure };

function failureKind(status: number): PostFailure {
  if (status === 429) return "rate_limited";
  return status < 500 ? "invalid" : "server";
}

async function post(url: string, init: RequestInit): Promise<PostResult> {
  try {
    const res = await fetch(url, { method: "POST", ...init });
    if (res.ok) return { ok: true };
    const data = (await res.json().catch(() => ({}))) as { error?: unknown };
    const error = typeof data.error === "string" ? data.error : "Något gick fel";
    return { ok: false, error, kind: failureKind(res.status) };
  } catch {
    return { ok: false, error: "Nätverksfel – försök igen", kind: "network" };
  }
}

export function postJson(url: string, body: unknown): Promise<PostResult> {
  return post(url, { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

/** multipart/form-data — the browser sets the boundary header itself. */
export function postForm(url: string, form: FormData): Promise<PostResult> {
  return post(url, { body: form });
}
