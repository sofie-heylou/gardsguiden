import type { Metadata } from "next";
import dynamic from "next/dynamic";

/** Kill switch for the step-by-step form: set SUBMIT_FORM_V2=1 in the
 *  environment to serve it, unset to fall back to the single-page form.  The
 *  page is static, so a flip takes effect on the next deploy.  Loading the
 *  chosen form dynamically keeps the other one out of the visitor's bundle. */
const WIZARD = process.env.SUBMIT_FORM_V2 === "1";

const Form = WIZARD
  ? dynamic(() => import("./wizard/SubmitFarmWizard"))
  : dynamic(() => import("./SubmitFarmForm"));

const copy = WIZARD
  ? {
      title: "Lägg till en gård",
      description: "Driver du en gård, eller känner du en som borde vara med? Lägg till den här — gratis, utan konto.",
      intro: "Gratis · Inget konto behövs",
    }
  : {
      title: "Lägg till din gård",
      description: "Finns din gård inte på Gårdsguiden? Skicka in uppgifterna så publicerar vi den inom några dagar.",
      intro: "Fyll i uppgifterna nedan så granskar vi och publicerar din gård inom några dagar.",
    };

export const metadata: Metadata = {
  title: copy.title,
  description: copy.description,
  alternates: { canonical: "/lagg-till" },
};

export default function LaggTillPage() {
  return (
    <div className="h-full overflow-y-auto" style={{ background: "#FAFAF8" }}>
      <div className="max-w-lg mx-auto px-4 py-6 pb-12 space-y-6">
        <div>
          <h1 className="font-display text-2xl text-stone-900">{copy.title}</h1>
          <p className="text-sm text-stone-500 mt-1 leading-relaxed">{copy.intro}</p>
        </div>
        <Form />
      </div>
    </div>
  );
}
