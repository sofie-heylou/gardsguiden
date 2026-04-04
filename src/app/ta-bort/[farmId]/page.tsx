import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getFarmById } from "../../../lib/farms";
import RemovalForm from "./RemovalForm";

export const metadata: Metadata = {
  title: "Ta bort gård",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ farmId: string }> };

export default async function TaBortPage({ params }: Props) {
  const { farmId } = await params;

  const farm = getFarmById(farmId);
  if (!farm) notFound();

  return <RemovalForm farmId={farm.id} farmName={farm.name} />;
}
