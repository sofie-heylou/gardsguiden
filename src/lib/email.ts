/** Thin email helper using the Resend API.
 *
 * Falls back to console.log when RESEND_API_KEY is not set so development
 * works without any credentials.  Never throws — errors are logged and
 * execution continues.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = "Gårdsguiden <noreply@gardsguiden.se>";
export const ADMIN_EMAIL = "hej@gardsguiden.se";

export interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  if (!RESEND_API_KEY) {
    console.log(
      `[email] No RESEND_API_KEY — would send:\n` +
      `  To:      ${Array.isArray(payload.to) ? payload.to.join(", ") : payload.to}\n` +
      `  Subject: ${payload.subject}\n` +
      `  Body:    ${payload.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}`
    );
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: Array.isArray(payload.to) ? payload.to : [payload.to],
        subject: payload.subject,
        html: payload.html,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "(no body)");
      console.error(`[email] Resend error ${res.status}: ${text}`);
    }
  } catch (err) {
    console.error("[email] Failed to send:", err);
  }
}

// ── Reusable HTML wrapper ─────────────────────────────────────────────────────

export function emailHtml(body: string): string {
  return `<!DOCTYPE html>
<html lang="sv">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAFAF8;font-family:system-ui,-apple-system,sans-serif;color:#2c2c2c;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;border:1px solid #e7e5e4;overflow:hidden;">
        <tr>
          <td style="background:#f59e0b;height:4px;font-size:0;">&nbsp;</td>
        </tr>
        <tr>
          <td style="padding:32px 36px;">
            <p style="margin:0 0 24px;font-size:18px;font-weight:700;color:#1c1917;letter-spacing:-0.3px;">Gårdsguiden</p>
            ${body}
            <hr style="border:none;border-top:1px solid #f5f5f4;margin:28px 0;">
            <p style="margin:0;font-size:12px;color:#a8a29e;">
              Gårdsguiden &mdash; <a href="https://www.gardsguiden.se" style="color:#a8a29e;">gardsguiden.se</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Row helper ────────────────────────────────────────────────────────────────

/** Escape text that came from a visitor before it goes into email HTML.
 *
 * Not cosmetic: these emails now carry one-click moderation buttons, so an
 * unescaped farm name or message can render a convincing fake button pointing
 * anywhere, in an inbox that has been trained to trust green buttons. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** A label/value row.  The value is escaped — pass trusted markup via rowRaw. */
export function row(label: string, value: string | null | undefined): string {
  if (!value) return "";
  return rowRaw(label, escapeHtml(value));
}

/** Same, for values we build ourselves and know to be safe markup (links). */
export function rowRaw(label: string, value: string | null | undefined): string {
  if (!value) return "";
  return `<tr>
    <td style="padding:4px 0;font-size:13px;color:#78716c;width:140px;vertical-align:top;">${escapeHtml(label)}</td>
    <td style="padding:4px 0;font-size:13px;color:#1c1917;vertical-align:top;">${value}</td>
  </tr>`;
}

/** A row whose value is a link we built ourselves. */
export function linkRow(label: string, href: string): string {
  return rowRaw(label, `<a href="${encodeURI(href)}" style="color:#1c1917;">${escapeHtml(href)}</a>`);
}

/** A visitor's free text plus a reply-to line, for forwarded-message emails. */
export function senderMessage(email: string, text: string): string {
  // encodeURIComponent neutralises a hostile address: the validation regex
  // permits "?", so victim@x.se?subject=…&body=… would otherwise pre-fill a
  // reply the attacker wrote. "@" is put back because some mail clients do not
  // reliably decode %40 in a mailto.
  const mailto = encodeURIComponent(email).replace(/%40/g, "@");
  return `<div style="margin-top:16px;padding:16px;background:#f5f5f4;border-radius:8px;font-size:14px;color:#1c1917;line-height:1.6;white-space:pre-wrap;">${escapeHtml(text)}</div>
      <p style="margin:12px 0 0;font-size:13px;color:#78716c;">
        Svara direkt till: <a href="mailto:${mailto}" style="color:#1c1917;">${escapeHtml(email)}</a>
      </p>`;
}

export function table(rows: string): string {
  return `<table cellpadding="0" cellspacing="0" style="width:100%;margin:16px 0;">${rows}</table>`;
}

export type BtnTone = "primary" | "approve" | "danger";

const BTN_BASE =
  "display:inline-block;margin-top:20px;padding:10px 22px;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;";

const BTN_TONES: Record<BtnTone, string> = {
  primary: "background:#1c1917;color:#fff;border:1px solid #1c1917;",
  approve: "background:#059669;color:#fff;border:1px solid #059669;",
  danger:  "background:#fff;color:#dc2626;border:1px solid #fecaca;",
};

export function btn(label: string, href: string, tone: BtnTone = "primary"): string {
  return `<a href="${encodeURI(href)}" style="${BTN_BASE}${BTN_TONES[tone]}">${escapeHtml(label)}</a>`;
}

/** Several buttons on one row, for the moderation links in admin emails. */
export function btnRow(buttons: { label: string; href: string; tone?: BtnTone }[]): string {
  return buttons
    .map(({ label, href, tone }) => `<span style="margin-right:8px;">${btn(label, href, tone)}</span>`)
    .join("");
}

