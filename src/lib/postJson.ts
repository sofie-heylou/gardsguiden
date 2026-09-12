/** One way to send a form to the site's own API, with the failure sorted into
 *  what the caller does with it: show the server's message, or the network
 *  one.  Client-safe: no React, nothing server-only. */

export type PostFailure = "rate_limited" | "server" | "network";

export type PostResult =
  | { ok: true }
  | { ok: false; error: string; kind: PostFailure };

export async function postJson(url: string, body: unknown): Promise<PostResult> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (res.ok) return { ok: true };
    return { ok: false, error: data.error ?? "Något gick fel", kind: res.status === 429 ? "rate_limited" : "server" };
  } catch {
    return { ok: false, error: "Nätverksfel – försök igen", kind: "network" };
  }
}
