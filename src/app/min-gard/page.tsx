import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "../../lib/db";
import { Search, PlusCircle, Clock } from "lucide-react";
import MinGardForm from "./MinGardForm";
import RemoveFarmButton from "./RemoveFarmButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Min gård",
  robots: { index: false, follow: false },
};

interface FarmRow {
  id: string;
  name: string;
  description: string;
  address: string;
  website: string;
  phone: string;
  products: string;
  openingHours: string;
  tier: string;
}

export default async function MinGardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/logga-in");

  const db = getDb();

  const ownerships = db
    .prepare(
      `SELECT farm_id FROM farm_ownership WHERE user_id = ? AND status = 'approved'`
    )
    .all(userId) as { farm_id: string }[];

  if (ownerships.length === 0) {
    const pending = db
      .prepare(
        `SELECT name FROM farm_submissions WHERE user_id = ? AND status = 'pending' LIMIT 1`
      )
      .get(userId) as { name: string } | undefined;

    return (
      <div className="h-full overflow-y-auto" style={{ background: "#FAFAF8" }}>
        <div className="max-w-lg mx-auto px-4 py-12 space-y-4 text-center">
          <h1 className="font-display text-2xl text-stone-900">Min gård</h1>

          {pending ? (
            <div className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
              <Clock size={15} className="shrink-0" />
              <span>
                Din ansökan för <strong>{pending.name}</strong> behandlas — vi återkommer snart.
              </span>
            </div>
          ) : (
            <p className="text-sm text-stone-500">Du har ingen kopplad gård ännu.</p>
          )}

          <div className="flex flex-col items-center gap-2 pt-2">
            <Link
              href="/lista"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-stone-800 text-white text-sm font-semibold hover:bg-stone-700 transition-colors"
            >
              <Search size={15} />
              Hitta och ansök om din gård
            </Link>
            <Link
              href="/lagg-till"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-stone-300 text-stone-700 text-sm font-semibold hover:border-stone-500 hover:text-stone-900 transition-colors"
            >
              <PlusCircle size={15} />
              Lägg till din gård
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const farms = ownerships
    .map(({ farm_id }) =>
      db
        .prepare(
          `SELECT id, name, description, address, website, phone, products, openingHours, tier
           FROM farms WHERE id = ?`
        )
        .get(farm_id) as FarmRow | undefined
    )
    .filter((f): f is FarmRow => f !== undefined)
    .map((row) => ({
      id: row.id,
      name: row.name ?? "",
      description: row.description ?? "",
      address: row.address ?? "",
      website: row.website ?? "",
      phone: row.phone ?? "",
      openingHours: row.openingHours ?? "",
      products:
        typeof row.products === "string"
          ? (JSON.parse(row.products) as string[])
          : (row.products ?? []),
      tier: row.tier ?? "free",
    }));

  return (
    <div className="h-full overflow-y-auto" style={{ background: "#FAFAF8" }}>
      <div className="max-w-lg mx-auto px-4 py-6 pb-12 space-y-10">
        {farms.map((farm) => (
          <div key={farm.id} className="space-y-3">
            <MinGardForm farm={farm} />
            <RemoveFarmButton farmId={farm.id} />
          </div>
        ))}

        <div className="pt-2 border-t border-stone-100">
          <Link
            href="/lagg-till"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-stone-300 text-stone-700 text-sm font-semibold hover:border-stone-500 hover:text-stone-900 transition-colors"
          >
            <PlusCircle size={15} />
            Lägg till en till gård
          </Link>
        </div>
      </div>
    </div>
  );
}
