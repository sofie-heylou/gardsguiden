"use client";

import { useReducer, useRef, useState } from "react";
import { trackAddFarm, type AddFarmMode } from "../../../lib/analytics";
import { postJson, type PostResult } from "../../../lib/postJson";
import { focusFirstInvalid } from "./fields";
import { errorKind, errorsAfterPatch, type StepErrors } from "./state";

/** What the owner's five steps and the visitor's tip form have in common:
 *  values and their errors changing together, the first touch that starts
 *  the clock, an error report that also points the visitor at the box, and a
 *  send whose failures show up in the same place. */

export type Patch<V> = Partial<V> | ((current: V) => Partial<V>);

interface FormState<V> { values: V; errors: StepErrors }

type FormAction<V> =
  | { type: "patch"; patch: Patch<V> }
  | { type: "errors"; errors: StepErrors }
  | { type: "replace"; values: V };

function reduce<V>(state: FormState<V>, action: FormAction<V>): FormState<V> {
  switch (action.type) {
    case "patch": {
      const patch = typeof action.patch === "function" ? action.patch(state.values) : action.patch;
      return { values: { ...state.values, ...patch }, errors: errorsAfterPatch(state.errors, Object.keys(patch)) };
    }
    case "errors":
      return { ...state, errors: action.errors };
    case "replace":
      return { values: action.values, errors: {} };
  }
}

export type Phase = "editing" | "sending" | "sent";

export function useAddFarmForm<V>(mode: AddFarmMode, initial: () => V) {
  const [{ values, errors }, dispatch] = useReducer(
    (state: FormState<V>, action: FormAction<V>) => reduce(state, action),
    undefined,
    (): FormState<V> => ({ values: initial(), errors: {} })
  );
  const [phase, setPhase] = useState<Phase>("editing");
  const [serverError, setServerError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const startedAt = useRef<number | null>(null);

  function update(patch: Patch<V>) {
    dispatch({ type: "patch", patch });
    if (startedAt.current === null) {
      startedAt.current = Date.now();
      trackAddFarm("add_farm_start", { mode });
    }
  }

  function replace(next: V) {
    dispatch({ type: "replace", values: next });
  }

  function clearErrors() {
    dispatch({ type: "errors", errors: {} });
  }

  /** Shows the errors, reports the first one, and puts focus on its box.
   *  Returns true when there was something to report. */
  function reportErrors(found: StepErrors, step: number): boolean {
    const firstKey = Object.keys(found)[0];
    if (!firstKey) return false;
    dispatch({ type: "errors", errors: found });
    trackAddFarm("add_farm_error", { mode, step, kind: errorKind(firstKey), field: firstKey.startsWith("_") ? undefined : firstKey });
    focusFirstInvalid(formRef.current);
    return true;
  }

  /** Sends, and on failure shows the message and reports it.  The caller
   *  decides what "sent" means (thank-you screen, cleared draft…). */
  async function send(body: unknown, step: number): Promise<PostResult> {
    setPhase("sending");
    setServerError("");
    const result = await postJson("/api/farms/submit", body);
    if (!result.ok) {
      setServerError(result.error);
      trackAddFarm("add_farm_error", { mode, step, kind: result.kind });
      setPhase("editing");
    } else {
      setPhase("sent");
    }
    return result;
  }

  return { values, errors, update, replace, clearErrors, reportErrors, send, phase, setPhase, serverError, formRef, startedAt };
}
