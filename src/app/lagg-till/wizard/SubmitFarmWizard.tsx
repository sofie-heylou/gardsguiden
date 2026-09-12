"use client";

import { useEffect, useReducer, useRef, useState, type FormEvent } from "react";
import { secondsSince, trackAddFarm } from "../../../lib/analytics";
import { normalizeLinks } from "../../../lib/links";
import { emptyWeek, formatOpeningHours } from "../../../lib/openingHours";
import { ProgressBar, StepButtons } from "./fields";
import {
  STEP_COUNT, STEP_ERROR_KEY, errorKind, errorsAfterPatch, initialValues, validateStep,
  type FormValues, type StepErrors,
} from "./state";
import Step1Farm from "./steps/Step1Farm";
import Step2Links from "./steps/Step2Links";
import Step3Offer from "./steps/Step3Offer";
import Step4Description from "./steps/Step4Description";
import Step5Review from "./steps/Step5Review";
import type { Patch } from "./steps/types";
import ThankYou from "./ThankYou";
import { clearDraft, formatDraftDate, readDraft, useDraftAutosave, type Draft } from "./useDraft";

type Phase = "editing" | "sending" | "sent";

const MODE = "owner" as const;

// Values and their errors change together — a box's message goes away as
// soon as its value changes — so they live in one reducer.
interface FormState { values: FormValues; errors: StepErrors }
type FormAction =
  | { type: "patch"; patch: Patch }
  | { type: "errors"; errors: StepErrors }
  | { type: "restore"; values: FormValues };

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "patch": {
      const patch = typeof action.patch === "function" ? action.patch(state.values) : action.patch;
      return { values: { ...state.values, ...patch }, errors: errorsAfterPatch(state.errors, Object.keys(patch)) };
    }
    case "errors":
      return { ...state, errors: action.errors };
    case "restore":
      return { values: action.values, errors: {} };
  }
}

/** A saved draft may predate a field; missing keys fall back to the blanks. */
function restoreValues(saved: FormValues): FormValues {
  return { ...initialValues(), ...saved, hours: { ...emptyWeek(), ...saved.hours } };
}

export default function SubmitFarmWizard() {
  const [{ values, errors }, dispatch] = useReducer(formReducer, undefined, () => ({ values: initialValues(), errors: {} }));
  const [step, setStep] = useState(1);
  const [returnToReview, setReturnToReview] = useState(false);
  const [phase, setPhase] = useState<Phase>("editing");
  const [serverError, setServerError] = useState("");
  // undefined: not looked yet · Draft: banner showing · null: decided.
  const [pendingDraft, setPendingDraft] = useState<Draft | null | undefined>(undefined);

  const rootRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const startedAt = useRef<number | null>(null);
  const mounted = useRef(false);

  useEffect(() => {
    // Effects run twice in development (Strict Mode); count the view once.
    if (mounted.current) return;
    mounted.current = true;
    trackAddFarm("add_farm_view", { mode: MODE });
    trackAddFarm("add_farm_step", { mode: MODE, step: 1 });
    setPendingDraft(readDraft());
  }, []);

  useDraftAutosave(values, step, pendingDraft === null && phase === "editing");

  function noteStart() {
    if (startedAt.current !== null) return;
    startedAt.current = Date.now();
    trackAddFarm("add_farm_start", { mode: MODE });
  }

  function update(patch: Patch) {
    dispatch({ type: "patch", patch });
    noteStart();
  }

  /** Every step change goes through here: one event, the new step brought
   *  into view, focus on its question. */
  function goTo(next: number) {
    dispatch({ type: "errors", errors: {} });
    setServerError("");
    setStep(next);
    trackAddFarm("add_farm_step", { mode: MODE, step: next });
    requestAnimationFrame(() => {
      rootRef.current?.scrollIntoView({ block: "start" });
      headingRef.current?.focus({ preventScroll: true });
    });
  }

  function handleNext(e: FormEvent) {
    e.preventDefault();
    const found = validateStep(step, values);
    const firstKey = Object.keys(found)[0];
    if (firstKey) {
      dispatch({ type: "errors", errors: found });
      trackAddFarm("add_farm_error", {
        mode: MODE, step, kind: errorKind(firstKey),
        field: firstKey === STEP_ERROR_KEY ? undefined : firstKey,
      });
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    if (step === STEP_COUNT) { void submit(); return; }
    if (returnToReview) { setReturnToReview(false); goTo(STEP_COUNT); return; }
    goTo(step + 1);
  }

  async function submit() {
    // Step 2 has already refused links that cannot be read, so this succeeds.
    const links = normalizeLinks(values);
    setPhase("sending");
    setServerError("");
    try {
      const res = await fetch("/api/farms/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setServerError(data.error ?? "Något gick fel");
        trackAddFarm("add_farm_error", { mode: MODE, step, kind: res.status === 429 ? "rate_limited" : "server" });
        setPhase("editing");
        return;
      }
      clearDraft();
      setPhase("sent");
      trackAddFarm("add_farm_submitted", { mode: MODE, seconds: secondsSince(startedAt.current) });
    } catch {
      setServerError("Nätverksfel – försök igen");
      trackAddFarm("add_farm_error", { mode: MODE, step, kind: "network" });
      setPhase("editing");
    }
  }

  function restoreDraft(draft: Draft) {
    dispatch({ type: "restore", values: restoreValues(draft.values) });
    startedAt.current = Date.now();
    setPendingDraft(null);
    trackAddFarm("add_farm_draft_restored", { mode: MODE });
    goTo(Math.min(Math.max(draft.step, 1), STEP_COUNT));
  }

  function startOver() {
    clearDraft();
    setPendingDraft(null);
  }

  if (phase === "sent") {
    return <ThankYou name={values.name} email={values.submittedEmail} lan={values.lan} />;
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

      <form ref={formRef} onSubmit={handleNext} noValidate className="space-y-4">
        {step === 1 && <Step1Farm {...stepProps} />}
        {step === 2 && <Step2Links {...stepProps} />}
        {step === 3 && <Step3Offer {...stepProps} />}
        {step === 4 && <Step4Description {...stepProps} />}
        {step === 5 && (
          <Step5Review
            {...stepProps}
            serverError={serverError}
            onEdit={(target) => { setReturnToReview(true); goTo(target); }}
          />
        )}

        <StepButtons
          onBack={step > 1 ? () => goTo(step - 1) : undefined}
          primaryLabel={primaryLabel}
          busy={phase === "sending"}
        />

        {step === 1 && (
          <p className="text-center text-xs text-emerald-700">✓ Sparas automatiskt i din webbläsare</p>
        )}
      </form>
    </div>
  );
}
