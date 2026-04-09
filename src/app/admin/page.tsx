import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "../../lib/db";
import OwnershipActions from "./OwnershipActions";
import SubmissionActions from "./SubmissionActions";
import FlaggedFarmActions from "./FlaggedFarmActions";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

interface FlaggedRow {
  id: string;
  name: string;
  website: string | null;
  kommun: string | null;
  lan: string | null;
}

interface PendingRow {
  id: number;
  farm_name: string;
  user_email: string;
  created_at: string;
}

interface SubmissionRow {
  id: string;
  name: string;
  submitted_email: string;
  lan: string | null;
  kommun: string | null;
  created_at: string;
}

export default async function AdminPage() {
  const { userId } = await auth();
  if (!userId) redirect("/logga-in");

  const db = getDb();
  const adminUser = db.prepare("SELECT role FROM users WHERE id = ?").get(userId) as
    | { role: string }
    | undefined;
  if (adminUser?.role !== "admin") notFound();

  const flagged = db.prepare(`
    SELECT id, name, website, kommun, lan
    FROM farms
    WHERE needs_review = 1
    ORDER BY lan, name
  `).all() as FlaggedRow[];

  const pending = db.prepare(`
    SELECT fo.id, f.name as farm_name, COALESCE(u.email, fo.user_id) as user_email, fo.created_at
    FROM farm_ownership fo
    JOIN farms f ON f.id = fo.farm_id
    LEFT JOIN users u ON u.id = fo.user_id
    WHERE fo.status = 'pending'
    ORDER BY fo.created_at ASC
  `).all() as PendingRow[];

  const submissions = db.prepare(`
    SELECT id, name, submitted_email, lan, kommun, created_at
    FROM farm_submissions WHERE status = 'pending'
    ORDER BY created_at ASC
  `).all() as SubmissionRow[];

  return (
    <div className="h-full overflow-y-auto" style={{ background: "#FAFAF8" }}>
      <div className="max-w-2xl mx-auto px-4 py-8 pb-14">
        <h1 className="font-display text-2xl text-stone-900 mb-6">Admin</h1>

        {flagged.length > 0 && (
          <section className="space-y-3 mb-8">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-red-400">
              Flaggade listningar — ej gårdar ({flagged.length})
            </h2>
            <ul className="space-y-2">
              {flagged.map((row) => (
                <li
                  key={row.id}
                  className="bg-white rounded-xl border border-red-100 shadow-sm px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="space-y-0.5 min-w-0">
                      <p className="font-display text-[15px] text-stone-900 leading-snug truncate">
                        {row.name}
                      </p>
                      {(row.kommun || row.lan) && (
                        <p className="text-[11px] text-stone-400">
                          {[row.kommun, row.lan].filter(Boolean).join(", ")}
                        </p>
                      )}
                      {row.website && (
                        <a
                          href={row.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-stone-400 underline hover:text-stone-600 transition-colors"
                        >
                          {row.website.replace(/^https?:\/\//, "")}
                        </a>
                      )}
                    </div>
                    <FlaggedFarmActions id={row.id} name={row.name} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">
            Väntande listningsansökningar ({submissions.length})
          </h2>

          {submissions.length === 0 ? (
            <p className="text-sm text-stone-500">Inga väntande listningar.</p>
          ) : (
            <ul className="space-y-2">
              {submissions.map((sub) => (
                <li
                  key={sub.id}
                  className="bg-white rounded-xl border border-stone-100 shadow-sm px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="space-y-0.5 min-w-0">
                      <p className="font-display text-[15px] text-stone-900 leading-snug truncate">
                        {sub.name}
                      </p>
                      <p className="text-[11px] text-stone-400">{sub.submitted_email}</p>
                      {(sub.kommun || sub.lan) && (
                        <p className="text-[11px] text-stone-400">
                          {[sub.kommun, sub.lan].filter(Boolean).join(", ")}
                        </p>
                      )}
                      <p className="text-[11px] text-stone-300">
                        {new Date(sub.created_at).toLocaleDateString("sv-SE", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    <SubmissionActions id={sub.id} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3 mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">
            Väntande ägarskapsansökningar ({pending.length})
          </h2>

          {pending.length === 0 ? (
            <p className="text-sm text-stone-500">Inga väntande ansökningar.</p>
          ) : (
            <ul className="space-y-2">
              {pending.map((row) => (
                <li
                  key={row.id}
                  className="bg-white rounded-xl border border-stone-100 shadow-sm px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="space-y-0.5 min-w-0">
                      <p className="font-display text-[15px] text-stone-900 leading-snug truncate">
                        {row.farm_name}
                      </p>
                      <p className="text-[11px] text-stone-400">{row.user_email}</p>
                      <p className="text-[11px] text-stone-300">
                        {new Date(row.created_at).toLocaleDateString("sv-SE", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    <OwnershipActions id={row.id} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
