"use client";

import { useReducer, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { secondsSince, trackAddFarm } from "../../../../lib/analytics";
import { MAX_EMAIL, MAX_LINK, MAX_NAME, MAX_TIP_MESSAGE } from "../../../../lib/limits";
import { classifyLink } from "../../../../lib/links";
import { inputCls } from "../../../../lib/ui";
import { CharCount, Field, StepButtons, StepHeading, cardCls, fieldAria, hintCls } from "../fields";
import { errorKind, errorsAfterPatch, initialTipValues, validateTip, type StepErrors, type TipValues } from "../state";

const MODE = "tip" as const;

interface TipState { values: TipValues; errors: StepErrors }
type TipAction = { type: "patch"; patch: Partial<TipValues> } | { type: "errors"; errors: StepErrors } | { type: "reset" };

function tipReducer(state: TipState, action: TipAction): TipState {
  switch (action.type) {
    case "patch":
      return { values: { ...state.values, ...action.patch }, errors: errorsAfterPatch(state.errors, Object.keys(action.patch)) };
    case "errors":
      return { ...state, errors: action.errors };
    case "reset":
      return { values: initialTipValues(), errors: {} };
  }
}

/** One screen: name and place required, a link, a note and an e-mail
 *  optional.  Owns its own state and send, so the owner form stays untouched. */
export default function TipForm() {
  const [{ values, errors }, dispatch] = useReducer(tipReducer, undefined, (): TipState => ({ values: initialTipValues(), errors: {} }));
  const [phase, setPhase] = useState<"editing" | "sending" | "sent">("editing");
  const [serverError, setServerError] = useState("");
  const [sentName, setSentName] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const startedAt = useRef<number | null>(null);

  function update(patch: Partial<TipValues>) {
    dispatch({ type: "patch", patch });
    if (startedAt.current === null) {
      startedAt.current = Date.now();
      trackAddFarm("add_farm_start", { mode: MODE });
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const found = validateTip(values);
    const firstKey = Object.keys(found)[0];
    if (firstKey) {
      dispatch({ type: "errors", errors: found });
      trackAddFarm("add_farm_error", { mode: MODE, step: 1, kind: firstKey === "link" ? "link_invalid" : errorKind(firstKey), field: firstKey });
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    void send();
  }

  async function send() {
    setPhase("sending");
    setServerError("");
    const link = classifyLink(values.link);
    try {
      const res = await fetch("/api/farms/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "visitor",
          name: values.name,
          address: values.place,
          ...(link ? { [link.field]: link.url } : {}),
          message: values.message,
          submittedEmail: values.email,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setServerError(data.error ?? "Något gick fel");
        trackAddFarm("add_farm_error", { mode: MODE, step: 1, kind: res.status === 429 ? "rate_limited" : "server" });
        setPhase("editing");
        return;
      }
      setSentName(values.name);
      setPhase("sent");
      trackAddFarm("add_farm_tip_submitted", { mode: MODE, seconds: secondsSince(startedAt.current) });
    } catch {
      setServerError("Nätverksfel – försök igen");
      trackAddFarm("add_farm_error", { mode: MODE, step: 1, kind: "network" });
      setPhase("editing");
    }
  }

  function another() {
    dispatch({ type: "reset" });
    startedAt.current = null;
    setPhase("editing");
  }

  if (phase === "sent") {
    return (
      <section className={cardCls}>
        <p className="flex items-center gap-2 text-lg font-semibold text-emerald-700">
          <Check size={20} className="shrink-0" />
          Tack för tipset!
        </p>
        <p className="text-sm text-stone-700">Vi kollar upp {sentName} och lägger till gården om den passar.</p>
        <div className="flex flex-wrap items-center gap-4 pt-1">
          <button type="button" onClick={another} className="min-h-11 px-4 rounded-lg border border-stone-300 text-sm font-semibold text-stone-800 hover:border-stone-500">
            Tipsa om en till gård
          </button>
          <Link href="/gardar" className="text-sm text-stone-600 underline hover:text-stone-900">Till gårdarna →</Link>
        </div>
      </section>
    );
  }

  const nameField = { id: "tip-name", error: errors.name };
  const placeField = { id: "tip-place", error: errors.place };
  const linkField = { id: "tip-link", error: errors.link, hint: "Hjälper oss hitta rätt gård." };
  const messageField = { id: "tip-message", error: errors.message };
  const emailField = { id: "tip-email", error: errors.email, hint: "Bara om vi behöver fråga något." };

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-4">
      <section className={cardCls}>
        <StepHeading sub="Namn och ort räcker – vi kollar upp resten och lägger till gården om den passar.">
          Tipsa om en gård
        </StepHeading>

        <Field {...nameField} label="Gårdens namn" mark="required">
          <input {...fieldAria(nameField)} type="text" name="name" maxLength={MAX_NAME} value={values.name} onChange={(e) => update({ name: e.target.value })} placeholder="t.ex. Ljungbackens gård" className={inputCls} />
        </Field>

        <Field {...placeField} label="Var ligger den?" mark="required">
          <input {...fieldAria(placeField)} type="text" name="place" maxLength={200} value={values.place} onChange={(e) => update({ place: e.target.value })} placeholder="Ort eller adress" className={inputCls} />
        </Field>

        <Field {...linkField} label="Hemsida, Instagram eller Facebook" mark="optional">
          <input {...fieldAria(linkField)} type="text" name="link" maxLength={MAX_LINK} value={values.link} onChange={(e) => update({ link: e.target.value })} placeholder="ljungbacken.se eller @ljungbacken" className={inputCls} />
        </Field>

        <Field {...messageField} label="Något mer vi bör veta?" mark="optional">
          <textarea {...fieldAria(messageField)} name="message" rows={3} maxLength={MAX_TIP_MESSAGE} value={values.message} onChange={(e) => update({ message: e.target.value })} placeholder='t.ex. "Säljer ägg och honung vid vägen på helger"' className={inputCls + " resize-y"} />
          <CharCount value={values.message} max={MAX_TIP_MESSAGE} />
        </Field>

        <Field {...emailField} label="Din e-post" mark="optional">
          <input {...fieldAria(emailField)} type="email" name="email" maxLength={MAX_EMAIL} autoComplete="email" value={values.email} onChange={(e) => update({ email: e.target.value })} placeholder="din@epost.se" className={inputCls} />
        </Field>
      </section>

      {serverError && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{serverError}</p>
      )}

      <StepButtons primaryLabel="Skicka tips" busy={phase === "sending"} />
      <p className={`${hintCls} text-center`}>Tips granskas av oss innan något visas på sidan.</p>
    </form>
  );
}
