import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getServerUser } from "../../../../lib/auth";
import { getDb } from "../../../../lib/db";
import EditFarmForm from "./EditFarmForm";

export const metadata: Metadata = {
  title: "Redigera gård",
  robots: { index: false, follow: false },
};

interface FarmData {
  id: string;
  name: string;
  description: string;
  address: string;
  website: string;
  phone: string;
  email: string;
  products: string[];
  openingHours: string;
  season: string;
  onSiteSales: boolean;
  tastingRoom: boolean;
}

type Props = { params: Promise<{ farmId: string }> };

export default async function RedigeraPage({ params }: Props) {
  const { farmId } = await params;

  const user = await getServerUser();
  if (!user) redirect("/logga-in");

  const db = getDb();
  const row = db.prepare(
    "SELECT id, name, description, address, website, phone, email, products, openingHours, season, onSiteSales, tastingRoom, claimed_by FROM farms WHERE id = ?"
  ).get(farmId) as (FarmData & { claimed_by: string | null }) | undefined;

  if (!row || row.claimed_by !== user.id) redirect("/konto");

  const farm: FarmData = {
    id: row.id,
    name: row.name ?? "",
    description: row.description ?? "",
    address: row.address ?? "",
    website: row.website ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    products: typeof row.products === "string"
      ? (JSON.parse(row.products) as string[])
      : (row.products ?? []),
    openingHours: row.openingHours ?? "",
    season: row.season ?? "",
    onSiteSales: row.onSiteSales === true || (row.onSiteSales as unknown) === 1,
    tastingRoom: row.tastingRoom === true || (row.tastingRoom as unknown) === 1,
  };

  return (
    <div className="h-full overflow-y-auto" style={{ background: "#FAFAF8" }}>
      <div className="max-w-lg mx-auto px-4 py-6 pb-12">
        <EditFarmForm farm={farm} />
      </div>
    </div>
  );
}
