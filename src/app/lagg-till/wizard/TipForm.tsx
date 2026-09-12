"use client";

import { type FormEvent } from "react";
import Link from "next/link";
import { secondsSince, trackAddFarm } from "../../../lib/analytics";
import { MAX_EMAIL, MAX_LINK, MAX_NAME, MAX_PLACE, MAX_TIP_MESSAGE } from "../../../lib/limits";
import { classifyLink } from "../../../lib/links";
import { inputCls } from "../../../lib/ui";
import { CharCount, Field, SentHeading, ServerError, StepButtons, StepHeading, cardCls, fieldAria, hintCls, secondaryBtnCls } from "./fields";
import { initialTipValues, validateTip } from "./state";
import { useAddFarmForm } from "./useAddFarmForm";

/** One screen: name and place required, a link, a note and an e-mail
 *  optional.  A tip is a lead for the normal intake, so nothing here has to
 *  be complete. */
export default function TipForm() {
  const form = useAddFarmForm("tip", initialTipValues);
  const { values, errors, update } = form;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (form.reportErrors(validateTip(values), 1)) return;
    const link = classifyLink(values.link);
    const result = await form.send({
      role: "visitor",
      name: values.name,
      address: values.place,
      ...(link ? { [link.field]: link.url } : {}),
      message: values.message,
      submittedEmail: values.email,
    }, 1);
    if (result.ok) trackAddFarm("add_farm_tip_submitted", { mode: "tip", seconds: secondsSince(form.startedAt.current) });
  }

  function another() {
    form.replace(initialTipValues());
    form.startedAt.current = null;
    form.setPhase("editing");
  }

  if (form.phase === "sent") {
    return (
      <section className={cardCls}>
        <SentHeading>Tack för tipset!</SentHeading>
        <p className="text-sm text-stone-700">Vi kollar upp {values.name} och lägger till gården om den passar.</p>
        <div className="flex flex-wrap items-center gap-4 pt-1">
          <button type="button" onClick={another} className={secondaryBtnCls}>Tipsa om en till gård</button>
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
    <form ref={form.formRef} onSubmit={handleSubmit} noValidate className="space-y-4">
      <section className={cardCls}>
        <StepHeading sub="Namn och ort räcker – vi kollar upp resten och lägger till gården om den passar.">
          Tipsa om en gård
        </StepHeading>

        <Field {...nameField} label="Gårdens namn" mark="required">
          <input {...fieldAria(nameField)} type="text" name="name" maxLength={MAX_NAME} autoComplete="organization" value={values.name} onChange={(e) => update({ name: e.target.value })} placeholder="t.ex. Ljungbackens gård" className={inputCls} />
        </Field>

        <Field {...placeField} label="Var ligger den?" mark="required">
          <input {...fieldAria(placeField)} type="text" name="place" maxLength={MAX_PLACE} value={values.place} onChange={(e) => update({ place: e.target.value })} placeholder="Ort eller adress" className={inputCls} />
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

      <ServerError message={form.serverError} />

      <StepButtons primaryLabel="Skicka tips" busy={form.phase === "sending"} />
      <p className={`${hintCls} text-center`}>Tips granskas av oss innan något visas på sidan.</p>
    </form>
  );
}
