import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "../../lib/db";
import { Search } from "lucide-react";
import MinGardForm from "./MinGardForm";

export const metadata: Metadata = {
  title: "Min gård",
  robots: { index: false, follow: false },
};

interface FarmRow {
  id: string;
  name: string;
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

  const ownership = db
    .prepare(
      `SELECT farm_id FROM farm_ownership WHERE user_id = ? AND status = 'approved' LIMIT 1`
    )
    .get(userId) as { farm_id: string } | undefined;

  if (!ownership) {
    return (
      <div className="h-full overflow-y-auto" style={{ background: "#FAFAF8" }}>
        <div className="max-w-lg mx-auto px-4 py-12 space-y-4 text-center">
          <h1 className="font-display text-2xl text-stone-900">Min gård</h1>
          <p className="text-sm text-stone-500">Du har ingen kopplad gård ännu.</p>
          <Link
            href="/lista"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-stone-800 text-white text-sm font-semibold hover:bg-stone-700 transition-colors"
          >
            <Search size={15} />
            Hitta och ansök om din gård
          </Link>
        </div>
      </div>
    );
  }

  const row = db
    .prepare(
      `SELECT id, name, address, website, phone, products, openingHours, tier
       FROM farms WHERE id = ?`
    )
    .get(ownership.farm_id) as FarmRow | undefined;

  if (!row) redirect("/konto");

  const farm = {
    id: row.id,
    name: row.name ?? "",
    address: row.address ?? "",
    website: row.website ?? "",
    phone: row.phone ?? "",
    openingHours: row.openingHours ?? "",
    products: typeof row.products === "string"
      ? (JSON.parse(row.products) as string[])
      : (row.products ?? []),
    tier: row.tier ?? "free",
  };

  return (
    <div className="h-full overflow-y-auto" style={{ background: "#FAFAF8" }}>
      <div className="max-w-lg mx-auto px-4 py-6 pb-12">
        <MinGardForm farm={farm} />
      </div>
    </div>
  );
}
