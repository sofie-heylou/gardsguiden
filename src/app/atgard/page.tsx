/** Confirmation page for the moderation links in notification emails.
 *
 * Opening the link only *shows* what would happen — the action runs when the
 * button is pressed.  That extra step is deliberate: mail clients, link
 * previewers and virus scanners routinely fetch every URL in a message, and a
 * GET that approved a farm would let a scanner moderate the site on its own.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidateFarmPages } from "../../lib/revalidateFarms";
import type { Metadata } from "next";
import { verifyActionToken, type AdminAction } from "../../lib/actionTokens";
import {
  getPendingSubmission,
  approveSubmission,
  rejectSubmission,
} from "../../lib/submissionActions";
import { getFarmSummary, clearFarmFlags, deleteFarm } from "../../lib/farmActions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Åtgärd",
  robots: { index: false, follow: false },
};

type Status = "done" | "gone" | "invalid";

/** What the page needs to know about a target before touching it. */
interface Target {
  name: string;
  subtitle?: string;
}

interface ActionSpec {
  /** Look up the target; null means "nothing left to act on". */
  load: (targetId: string) => Target | null;
  /** The question shown before the button. */
  question: (target: Target) => string;
  confirmLabel: string;
  tone: "approve" | "danger";
  /** Shown when load() returns null. */
  goneText: string;
  run: (targetId: string) => { ok: boolean };
  /** Whether this action changes what the cached farm pages should show.
   *  Deliberately required: a new action must state its cache impact rather
   *  than inherit "no" by omission. */
  revalidates: boolean;
}

function loadSubmission(targetId: string): Target | null {
  const submission = getPendingSubmission(targetId);
  return submission
    ? { name: submission.name, subtitle: `Inskickad av ${submission.submitted_email}` }
    : null;
}

function loadFarm(targetId: string): Target | null {
  const farm = getFarmSummary(targetId);
  if (!farm) return null;
  const flags = farm.user_flag_count;
  return {
    name: farm.name,
    subtitle: flags > 0 ? `${flags} flagg${flags === 1 ? "a" : "or"} från besökare` : undefined,
  };
}

const SUBMISSION_GONE = "Ansökan är redan godkänd eller avvisad — ingenting har ändrats.";
const FARM_GONE = "Gården finns inte längre — ingenting har ändrats.";

/** The single registry of what a token may do.  Because it is keyed by
 *  AdminAction, adding an action to that union fails to compile until it is
 *  handled here — the page has no `if (action === ...)` branches. */
const ACTIONS: Record<AdminAction, ActionSpec> = {
  "submission:approve": {
    load: loadSubmission,
    question: (t) => `Godkänn ${t.name} och publicera gården?`,
    confirmLabel: "Ja, godkänn",
    tone: "approve",
    goneText: SUBMISSION_GONE,
    run: approveSubmission,
    revalidates: true, // publishes a farm onto the cached lists
  },
  "submission:reject": {
    load: loadSubmission,
    question: (t) => `Avvisa ansökan för ${t.name}?`,
    confirmLabel: "Ja, avvisa",
    tone: "danger",
    goneText: SUBMISSION_GONE,
    run: rejectSubmission,
    revalidates: false,
  },
  "farm:clear-flags": {
    load: loadFarm,
    question: (t) => `Rensa flaggorna för ${t.name} och behålla gården?`,
    confirmLabel: "Ja, rensa flaggorna",
    tone: "approve",
    goneText: FARM_GONE,
    run: clearFarmFlags,
    revalidates: false, // flag counts are not rendered on public pages
  },
  "farm:delete": {
    load: loadFarm,
    question: (t) => `Ta bort ${t.name} permanent?`,
    confirmLabel: "Ja, ta bort gården",
    tone: "danger",
    goneText: FARM_GONE,
    run: deleteFarm,
    revalidates: true,
  },
};

const STATUS_TEXT: Record<Status, { title: string; body: string }> = {
  done: {
    title: "Klart",
    body: "Åtgärden är utförd och berörda e-postmeddelanden har skickats.",
  },
  gone: {
    title: "Redan hanterad",
    body: "Ingenting har ändrats.",
  },
  invalid: {
    title: "Länken fungerar inte",
    body: "Länken är ogiltig eller har gått ut. Öppna det senaste mejlet, eller hantera ärendet i adminvyn.",
  },
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
        {children}
      </div>
    </div>
  );
}

function Result({ status, body }: { status: Status; body?: string }) {
  const text = STATUS_TEXT[status];
  return (
    <Shell>
      <p className="text-lg font-semibold text-stone-900">{text.title}</p>
      <p className="mt-2 text-sm leading-relaxed text-stone-500">{body ?? text.body}</p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-lg bg-amber-400 px-3.5 py-1.5 text-xs font-semibold text-stone-900 transition-colors hover:bg-amber-300"
      >
        Till kartan
      </Link>
    </Shell>
  );
}

export default async function AtgardPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; status?: string }>;
}) {
  const { token, status } = await searchParams;

  if (status && status in STATUS_TEXT) {
    return <Result status={status as Status} />;
  }

  const verified = verifyActionToken(token);
  if (!verified) return <Result status="invalid" />;

  const spec = ACTIONS[verified.action];
  const target = spec.load(verified.targetId);
  if (!target) return <Result status="gone" body={spec.goneText} />;

  async function perform(formData: FormData) {
    "use server";

    // Re-verify rather than trusting the hidden field: the form is served to
    // whoever holds the link, and this runs on a fresh request.
    const checked = verifyActionToken(formData.get("token"));
    if (!checked) redirect("/atgard?status=invalid");

    const spec = ACTIONS[checked.action];
    const result = spec.run(checked.targetId);
    if (result.ok && spec.revalidates) revalidateFarmPages();
    redirect(`/atgard?status=${result.ok ? "done" : "gone"}`);
  }

  return (
    <Shell>
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Gårdsguiden</p>
      <p className="mt-3 text-lg font-semibold leading-snug text-stone-900">
        {spec.question(target)}
      </p>
      {target.subtitle && <p className="mt-2 text-sm text-stone-500">{target.subtitle}</p>}

      <form action={perform} className="mt-6">
        <input type="hidden" name="token" value={token} />
        <button
          type="submit"
          className={
            spec.tone === "danger"
              ? "w-full rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:border-red-400"
              : "w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
          }
        >
          {spec.confirmLabel}
        </button>
      </form>

      <p className="mt-4 text-xs text-stone-400">
        Ingenting händer förrän du trycker på knappen.
      </p>
    </Shell>
  );
}
