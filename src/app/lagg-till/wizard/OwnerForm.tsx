"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { secondsSince, trackAddFarm } from "../../../lib/analytics";
import { normalizeLinks } from "../../../lib/links";
import { emptyWeek, formatOpeningHours } from "../../../lib/openingHours";
import { ProgressBar, StepButtons } from "./fields";
import { STEP_COUNT, initialValues, validateStep, type FormValues } from "./state";
import Step1Farm from "./steps/Step1Farm";
import Step2Links from "./steps/Step2Links";
import Step3Offer from "./steps/Step3Offer";
import Step4Description from "./steps/Step4Description";
import Step5Review from "./steps/Step5Review";
import ThankYou from "./ThankYou";
import { useAddFarmForm } from "./useAddFarmForm";
import { clearDraft, formatDraftDate, readDraft, useDraftAutosave, type Draft } from "./useDraft";

const MODE = "owner" as const;

/** A saved draft may predate a field; missing keys fall back to the blanks. */
function restoreValues(saved: FormValues): FormValues {
  return { ...initialValues(), ...saved, hours: { ...emptyWeek(), ...saved.hours } };
}

/** The five-step owner form.  Step 1's "shown" event belongs to the page
 *  container, which knows which side is on screen. */
export default function OwnerForm({ onTip, photosOpen }: { onTip: () => void; photosOpen: boolean }) {
  const form = useAddFarmForm(MODE, initialValues);
  const { values, errors, update } = form;
  const [step, setStep] = useState(1);
  /** The id the submit endpoint answered with — what a thank-you upload attaches to. */
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [returnToReview, setReturnToReview] = useState(false);
  // undefined: not looked yet · Draft: banner showing · null: decided.
  const [pendingDraft, setPendingDraft] = useState<Draft | null | undefined>(undefined);
  const rootRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(false);

  useEffect(() => {
    // Effects run twice in development (Strict Mode); read the draft once.
    if (mounted.current) return;
    mounted.current = true;
    setPendingDraft(readDraft());
  }, []);

  useDraftAutosave(values, step, pendingDraft === null && form.phase === "editing");

  /** Every step change goes through here: one event, the new step brought
   *  into view, focus on its question. */
  function goTo(next: number) {
    form.clearErrors();
    setStep(next);
    trackAddFarm("add_farm_step", { mode: MODE, step: next });
    requestAnimationFrame(() => {
      rootRef.current?.scrollIntoView({ block: "start" });
      headingRef.current?.focus({ preventScroll: true });
    });
  }

  async function handleNext(e: FormEvent) {
    e.preventDefault();
    if (form.reportErrors(validateStep(step, values), step)) return;
    if (step < STEP_COUNT) {
      if (returnToReview) { setReturnToReview(false); goTo(STEP_COUNT); } else goTo(step + 1);
      return;
    }
    // Step 2 has already refused links that cannot be read, so this succeeds.
    const links = normalizeLinks(values);
    const result = await form.send({
      name: values.name, description: values.description,
      address: values.address, kommun: values.kommun, lan: values.lan,
      ...(links.ok ? links.values : {}),
      phone: values.phone, email: values.email,
      products: values.products,
      onSiteSales: values.onSiteSales, tastingRoom: values.tastingRoom,
      openingHours: values.hoursMode === "fixed" ? formatOpeningHours(values.hours) : "",
      season: values.season,
      submittedEmail: values.submittedEmail,
      lat: values.lat, lng: values.lng,
    }, step);
    if (result.ok) {
      clearDraft();
      setSubmissionId(typeof result.data.id === "string" ? result.data.id : null);
      trackAddFarm("add_farm_submitted", { mode: MODE, seconds: secondsSince(form.startedAt.current) });
    }
  }

  function restoreDraft(draft: Draft) {
    form.replace(restoreValues(draft.values));
    form.startedAt.current = Date.now();
    setPendingDraft(null);
    trackAddFarm("add_farm_draft_restored", { mode: MODE });
    goTo(Math.min(Math.max(draft.step, 1), STEP_COUNT));
  }

  function startOver() {
    clearDraft();
    setPendingDraft(null);
  }

  if (form.phase === "sent") {
    return (
      <ThankYou
        name={values.name}
        email={values.submittedEmail}
        lan={values.lan}
        onTip={onTip}
        photoTarget={photosOpen && submissionId ? { kind: "submission", id: submissionId } : null}
      />
    );
  }

  const stepProps = { values, errors, update, headingRef };
  const primaryLabel =
    step === STEP_COUNT ? "Skicka in gård"
    : returnToReview ? "Klar – tillbaka till granskning"
    : "Nästa →";

  return (
    <div ref={rootRef} className="space-y-4">
      {pendingDraft && (
        <div role="region" aria-label="Påbörjat formulär" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-stone-800 space-y-2">
          <p>Du har ett påbörjat formulär från {formatDraftDate(pendingDraft.savedAt)}.</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => restoreDraft(pendingDraft)} className="min-h-11 px-4 rounded-lg bg-stone-800 text-white text-sm font-semibold hover:bg-stone-700">
              Fortsätt
            </button>
            <button type="button" onClick={startOver} className="min-h-11 px-3 text-sm text-stone-600 underline hover:text-stone-900">
              Börja om
            </button>
          </div>
        </div>
      )}

      <ProgressBar step={step} />

      <form ref={form.formRef} onSubmit={handleNext} noValidate className="space-y-4">
        {step === 1 && <Step1Farm {...stepProps} />}
        {step === 2 && <Step2Links {...stepProps} />}
        {step === 3 && <Step3Offer {...stepProps} />}
        {step === 4 && <Step4Description {...stepProps} />}
        {step === 5 && (
          <Step5Review
            {...stepProps}
            serverError={form.serverError}
            onEdit={(target) => { setReturnToReview(true); goTo(target); }}
          />
        )}

        <StepButtons
          onBack={step > 1 ? () => goTo(step - 1) : undefined}
          primaryLabel={primaryLabel}
          busy={form.phase === "sending"}
        />

        {step === 1 && (
          <p className="text-center text-xs text-emerald-700">✓ Sparas automatiskt i din webbläsare</p>
        )}
      </form>
    </div>
  );
}
