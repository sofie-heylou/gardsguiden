import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import { MapPin, BadgeCheck, ArrowRight, PlusCircle, Search, Clock } from "lucide-react";
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

interface PendingOwnershipRow {
  ownership_id: number;
  id: string;
  name: string;
  lan: Farm["lan"];
  kommun: string;
}

export default async function KontoPage() {
  const user = await currentUser();
  if (!user) redirect("/logga-in");

  const userId = user.id;
  const userEmail = user.primaryEmailAddress?.emailAddress ?? "";

  const db = getDb();

  // Confirmed farms (ownership approved + claimed_by set)
  const claimedFarms = db
    .prepare(`SELECT id, name, lan, kommun FROM farms WHERE claimed_by = ? ORDER BY name`)
    .all(userId) as ClaimedFarmRow[];

  // Pending ownership requests
  const pendingOwnerships = db
    .prepare(
      `SELECT fo.id as ownership_id, f.id, f.name, f.lan, f.kommun
       FROM farm_ownership fo
       JOIN farms f ON f.id = fo.farm_id
       WHERE fo.user_id = ? AND fo.status = 'pending'
       ORDER BY fo.created_at DESC`
    )
    .all(userId) as PendingOwnershipRow[];

  // Don't show pending if already confirmed
  const confirmedIds = new Set(claimedFarms.map((f) => f.id));
  const pendingOnly = pendingOwnerships.filter((r) => !confirmedIds.has(r.id));

  const hasAnyFarms = claimedFarms.length > 0 || pendingOnly.length > 0;

  return (
    <div className="h-full overflow-y-auto" style={{ background: "#FAFAF8" }}>
      <div className="max-w-lg mx-auto px-4 py-6 pb-12 space-y-8">

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-400 mb-1">
            Inloggad
          </p>
          <h1 className="font-display text-2xl text-stone-900">Mitt konto</h1>
          <p className="text-sm text-stone-500 mt-0.5">{userEmail}</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">
            Mina gårdar
          </h2>

          {hasAnyFarms ? (
            <ul className="space-y-2">
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
                      href="/min-gard"
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

              {pendingOnly.map((item) => (
                <li
                  key={item.ownership_id}
                  className="bg-white rounded-xl border border-stone-100 shadow-sm px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-display text-[15px] text-stone-900 leading-snug truncate">
                        {item.name}
                      </h3>
                      <p className="flex items-center gap-1 text-[11px] text-stone-400 mt-0.5">
                        <MapPin size={10} />
                        {item.kommun} · {item.lan}
                      </p>
                    </div>
                    <span className="shrink-0 flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                      <Clock size={11} />
                      Ansökan skickad
                    </span>
                  </div>

                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-stone-50">
                    <Link
                      href={farmPath({ id: item.id, lan: item.lan } as Farm)}
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

        <LogoutButton />

      </div>
    </div>
  );
}
