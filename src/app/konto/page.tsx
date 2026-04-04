import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, BadgeCheck, ArrowRight, PlusCircle, Search, Clock } from "lucide-react";
import { getServerUser } from "../../lib/auth";
import { getDb } from "../../lib/db";
import { farmPath } from "../../lib/counties";
import LogoutButton from "../../components/LogoutButton";
import type { Farm } from "../../types/farm";

export const metadata: Metadata = {
  title: "Mitt konto",
  robots: { index: false, follow: false },
};

interface ClaimedFarmRow {
  id: string;
  name: string;
  lan: Farm["lan"];
  kommun: string;
}

interface PendingClaimRow {
  claim_id: string;
  id: string;
  name: string;
  lan: Farm["lan"];
  kommun: string;
}

type Props = { searchParams: Promise<{ betalat?: string }> };

export default async function KontoPage({ searchParams }: Props) {
  const user = await getServerUser();
  if (!user) redirect("/logga-in");

  const { betalat } = await searchParams;

  const db = getDb();

  // Confirmed farms (payment confirmed, claimed_by set)
  const claimedFarms = db
    .prepare(
      `SELECT id, name, lan, kommun FROM farms WHERE claimed_by = ? ORDER BY name`
    )
    .all(user.id) as ClaimedFarmRow[];

  // Claims awaiting payment confirmation
  const pendingClaims = db
    .prepare(
      `SELECT fc.id as claim_id, f.id, f.name, f.lan, f.kommun
       FROM farm_claims fc
       JOIN farms f ON f.id = fc.farm_id
       WHERE fc.user_id = ? AND fc.payment_status = 'pending_payment'
       ORDER BY fc.created_at DESC`
    )
    .all(user.id) as PendingClaimRow[];

  // Deduplicate: don't show a farm as both confirmed and pending
  const confirmedIds = new Set(claimedFarms.map((f) => f.id));
  const pendingOnly = pendingClaims.filter((c) => !confirmedIds.has(c.id));

  const hasAnyFarms = claimedFarms.length > 0 || pendingOnly.length > 0;

  return (
    <div className="h-full overflow-y-auto" style={{ background: "#FAFAF8" }}>
      <div className="max-w-lg mx-auto px-4 py-6 pb-12 space-y-8">

        {/* ── Payment confirmation banner ──────────────────────────────────── */}
        {betalat && (
          <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3">
            <p className="text-sm font-medium text-amber-800">Tack!</p>
            <p className="text-xs text-amber-600 mt-0.5">
              Vi verifierar din betalning och aktiverar ditt konto inom 24 timmar.
            </p>
          </div>
        )}

        {/* ── User header ─────────────────────────────────────────────────── */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-400 mb-1">
            Inloggad
          </p>
          <h1 className="font-display text-2xl text-stone-900">
            {user.name ?? "Mitt konto"}
          </h1>
          <p className="text-sm text-stone-500 mt-0.5">{user.email}</p>
        </div>

        {/* ── Mina gårdar ─────────────────────────────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">
            Mina gårdar
          </h2>

          {hasAnyFarms ? (
            <ul className="space-y-2">
              {/* Confirmed / active farms */}
              {claimedFarms.map((farm) => (
                <li
                  key={farm.id}
                  className="bg-white rounded-xl border border-stone-100 shadow-sm px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-display text-[15px] text-stone-900 leading-snug truncate">
                        {farm.name}
                      </h3>
                      <p className="flex items-center gap-1 text-[11px] text-stone-400 mt-0.5">
                        <MapPin size={10} />
                        {farm.kommun} · {farm.lan}
                      </p>
                    </div>
                    <span className="shrink-0 flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                      <BadgeCheck size={11} />
                      Verifierad
                    </span>
                  </div>

                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-stone-50">
                    <Link
                      href={`/konto/redigera/${farm.id}`}
                      className="text-xs font-medium text-stone-600 hover:text-stone-900 transition-colors"
                    >
                      Redigera
                    </Link>
                    <Link
                      href={farmPath({ id: farm.id, lan: farm.lan } as Farm)}
                      className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-700 transition-colors"
                    >
                      Visa sida <ArrowRight size={11} />
                    </Link>
                  </div>
                </li>
              ))}

              {/* Pending payment claims */}
              {pendingOnly.map((claim) => (
                <li
                  key={claim.claim_id}
                  className="bg-white rounded-xl border border-stone-100 shadow-sm px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-display text-[15px] text-stone-900 leading-snug truncate">
                        {claim.name}
                      </h3>
                      <p className="flex items-center gap-1 text-[11px] text-stone-400 mt-0.5">
                        <MapPin size={10} />
                        {claim.kommun} · {claim.lan}
                      </p>
                    </div>
                    <span className="shrink-0 flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                      <Clock size={11} />
                      Inväntar betalning
                    </span>
                  </div>

                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-stone-50">
                    <Link
                      href={farmPath({ id: claim.id, lan: claim.lan } as Farm)}
                      className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-700 transition-colors"
                    >
                      Visa sida <ArrowRight size={11} />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="bg-white rounded-xl border border-stone-100 shadow-sm p-6 space-y-4">
              <p className="text-sm text-stone-500">
                Du har inga gårdar kopplade till ditt konto än.
              </p>
              <div className="flex flex-col gap-2">
                <Link
                  href="/lista"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-stone-800 text-white text-sm font-semibold hover:bg-stone-700 transition-colors"
                >
                  <Search size={15} />
                  Hitta din gård
                </Link>
                <Link
                  href="/lagg-till"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-stone-200 text-stone-700 text-sm font-medium hover:border-stone-400 transition-colors"
                >
                  <PlusCircle size={15} />
                  Lägg till din gård
                </Link>
              </div>
            </div>
          )}
        </section>

        {/* ── Logout ──────────────────────────────────────────────────────── */}
        <LogoutButton />

      </div>
    </div>
  );
}
