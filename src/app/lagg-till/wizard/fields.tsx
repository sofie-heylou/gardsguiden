"use client";

import { Check, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { STEP_COUNT, STEP_TITLES } from "./state";

/** The building blocks every step is made of.  Readability rules from the
 *  spec live here once: 14 px dark labels, 12 px hints, error text tied to
 *  its box with aria-describedby, and tap targets of at least 44 px. */

export const labelCls = "block text-sm font-medium text-stone-700";
export const hintCls = "text-xs text-stone-500 leading-relaxed";
export const errorTextCls = "text-sm text-red-700";
export const cardCls = "bg-white rounded-xl border border-stone-100 shadow-sm p-5 space-y-4";
export const secondaryBtnCls = "min-h-11 px-4 rounded-lg border border-stone-300 text-sm font-semibold text-stone-800 hover:border-stone-500";

/** After a failed check: focus lands on the first box marked invalid, once
 *  React has painted the marks. */
export function focusFirstInvalid(form: HTMLFormElement | null): void {
  requestAnimationFrame(() => form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
}

/** What a box and its Field share: the id, and the message or hint under it. */
export interface FieldSpec {
  id: string;
  error?: string;
  hint?: string;
}

export function Field({ id, error, hint, label, mark, children }: FieldSpec & {
  label: string;
  mark?: "required" | "optional";
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={labelCls}>
        {label}
        {mark === "required" && <span className="text-red-600 ml-0.5" aria-hidden="true">*</span>}
        {mark === "optional" && <Optional />}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className={errorTextCls}>{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className={hintCls}>{hint}</p>
      ) : null}
    </div>
  );
}

/** The aria wiring for the box inside a Field; spread onto the input. */
export function fieldAria({ id, error, hint }: FieldSpec) {
  return {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : hint ? `${id}-hint` : undefined,
  } as const;
}

function Optional() {
  return <span className="text-stone-500 font-normal"> (valfritt)</span>;
}

export function StepHeading({ children, sub, optional, headingRef }: {
  children: ReactNode;
  sub?: ReactNode;
  optional?: boolean;
  headingRef?: React.Ref<HTMLHeadingElement>;
}) {
  return (
    <div className="space-y-1">
      <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold text-stone-900 outline-none">
        {children}
        {optional && <Optional />}
      </h2>
      {sub && <p className={hintCls}>{sub}</p>}
    </div>
  );
}

export function Switch({ label, description, checked, onChange }: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="w-full min-h-11 flex items-center justify-between gap-4 py-1 text-left"
    >
      <span>
        <span className="block text-sm text-stone-800">{label}</span>
        {description && <span className={`block ${hintCls}`}>{description}</span>}
      </span>
      <span className={`shrink-0 w-11 h-6 rounded-full transition-colors relative ${checked ? "bg-stone-800" : "bg-stone-200"}`}>
        <span className={`absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
      </span>
    </button>
  );
}

export function Chip({ label, pressed, onToggle }: {
  label: string;
  pressed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onToggle}
      className={`min-h-11 px-4 rounded-full text-sm font-medium transition-colors ${
        pressed ? "bg-stone-800 text-white" : "bg-white text-stone-700 border border-stone-300 hover:border-stone-500"
      }`}
    >
      {label}
    </button>
  );
}

export function RadioCard({ name, value, checked, onSelect, label, description }: {
  name: string;
  value: string;
  checked: boolean;
  onSelect: () => void;
  label: string;
  description?: string;
}) {
  const id = `${name}-${value}`;
  return (
    <label
      htmlFor={id}
      className={`flex items-start gap-3 min-h-11 rounded-lg border px-3 py-2.5 cursor-pointer ${
        checked ? "border-stone-800 bg-stone-50" : "border-stone-200"
      }`}
    >
      <input id={id} type="radio" name={name} value={value} checked={checked} onChange={onSelect} className="mt-1 accent-stone-800" />
      <span>
        <span className="block text-sm text-stone-800">{label}</span>
        {description && <span className={`block ${hintCls}`}>{description}</span>}
      </span>
    </label>
  );
}

const svNumber = new Intl.NumberFormat("sv-SE");

export function CharCount({ value, max }: { value: string; max: number }) {
  return (
    <p className="text-xs text-stone-500 text-right" aria-live="polite">
      {svNumber.format(value.length)} / {svNumber.format(max)} tecken
    </p>
  );
}

export function ProgressBar({ step }: { step: number }) {
  return (
    <div className="space-y-2" aria-label={`Steg ${step} av ${STEP_COUNT}`} role="group">
      <div className="flex items-center justify-between text-xs font-semibold text-stone-600">
        <span>Steg {step} av {STEP_COUNT}{step === 1 && " · ca 3 min"}</span>
        <span>{STEP_TITLES[step - 1]}</span>
      </div>
      <div className="flex gap-1" aria-hidden="true">
        {STEP_TITLES.map((title, i) => (
          <span key={title} className={`flex-1 h-1 rounded-full ${i < step ? "bg-stone-800" : "bg-stone-200"}`} />
        ))}
      </div>
    </div>
  );
}

export function StepButtons({ onBack, primaryLabel, busy }: {
  onBack?: () => void;
  primaryLabel: string;
  busy?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      {onBack && (
        <button type="button" onClick={onBack} className="min-h-11 px-3 text-sm text-stone-600 hover:text-stone-900 transition-colors">
          ← Tillbaka
        </button>
      )}
      <button
        type="submit"
        disabled={busy}
        className="flex-1 min-h-11 flex items-center justify-center gap-2 py-3 rounded-xl bg-stone-800 text-white text-sm font-semibold hover:bg-stone-700 active:bg-stone-900 transition-colors disabled:opacity-50"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : primaryLabel}
      </button>
    </div>
  );
}

/** The green tick line that opens every "it went through" screen. */
export function SentHeading({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-lg font-semibold text-emerald-700">
      <Check size={20} className="shrink-0" />
      {children}
    </p>
  );
}

/** What the server said when a send failed; nothing when it did not. */
export function ServerError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      {message}
    </p>
  );
}
