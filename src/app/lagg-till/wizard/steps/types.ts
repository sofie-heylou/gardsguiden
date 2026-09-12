import type { RefObject } from "react";
import type { FormValues, StepErrors } from "../state";
import type { Patch as AnyPatch } from "../useAddFarmForm";

export type Patch = AnyPatch<FormValues>;

/** What every step gets: the values, this step's errors, one way to change
 *  things, and the heading to focus when the step appears. */
export interface StepProps {
  values: FormValues;
  errors: StepErrors;
  /** Pass a function when the change builds on the latest values (toggles),
   *  so two quick taps never lose one. */
  update: (patch: Patch) => void;
  headingRef: RefObject<HTMLHeadingElement | null>;
}
