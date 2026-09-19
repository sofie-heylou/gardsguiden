/** Print a moderation link for a local dev server — the same link the
 *  notification e-mail would carry, but the e-mail only lands in the log when
 *  RESEND_API_KEY is unset and the log strips the HTML.
 *
 *  Usage: npx tsx scripts/mint-action-link.ts photo:approve <photoId>
 *  Uses whatever ADMIN_ACTION_SECRET the shell has (the dev fallback when
 *  unset), so the link verifies against a dev server started the same way. */

import { actionUrl, ADMIN_ACTIONS, type AdminAction } from "../src/lib/actionTokens";

const [action, id, origin = "http://localhost:3000"] = process.argv.slice(2);
if (!ADMIN_ACTIONS.includes(action as AdminAction) || !id) {
  console.error(`Usage: npx tsx scripts/mint-action-link.ts <${ADMIN_ACTIONS.join("|")}> <targetId> [origin]`);
  process.exit(1);
}
console.log(actionUrl(action as AdminAction, id).replace(/^https?:\/\/[^/]+/, origin));
