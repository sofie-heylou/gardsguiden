import type { Metadata } from "next";
import SubmitFarmForm from "./SubmitFarmForm";

export const metadata: Metadata = {
  title: "Lägg till din gård",
  description:
    "Finns din gård inte på Gårdsguiden? Skicka in uppgifterna så publicerar vi den inom några dagar.",
  alternates: { canonical: "/lagg-till" },
};

export default function LaggTillPage() {
  return (
    <div className="h-full overflow-y-auto" style={{ background: "#FAFAF8" }}>
      <div className="max-w-lg mx-auto px-4 py-6 pb-12 space-y-6">

        <div>
          <h1 className="font-display text-2xl text-stone-900">Lägg till din gård</h1>
          <p className="text-sm text-stone-500 mt-1 leading-relaxed">
            Fyll i uppgifterna nedan så granskar vi och publicerar din gård
            inom några dagar.
          </p>
        </div>

        <SubmitFarmForm />

      </div>
    </div>
  );
}
