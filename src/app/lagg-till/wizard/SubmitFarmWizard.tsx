"use client";

import { useEffect, useRef, useState } from "react";
import { trackAddFarm, type AddFarmMode } from "../../../lib/analytics";
import OwnerForm from "./OwnerForm";
import TipForm from "./TipForm";

const TABS: { mode: AddFarmMode; label: string }[] = [
  { mode: "owner", label: "Jag driver gården" },
  { mode: "tip",   label: "Jag vill tipsa om en gård" },
];

/** The page's two sides: the owner's five steps, and a visitor's one-screen
 *  tip.  A side is mounted the first time it is shown and stays mounted, so
 *  switching never loses what was typed — and a visitor who only came to tip
 *  never loads the owner form's address widget. */
export default function SubmitFarmWizard({ initialMode, photosOpen }: {
  initialMode: AddFarmMode;
  /** The FARM_PHOTOS switch, read by the page: shows the photo upload on the
   *  thank-you screen. */
  photosOpen: boolean;
}) {
  const [mode, setMode] = useState<AddFarmMode>(initialMode);
  const [seen, setSeen] = useState<Set<AddFarmMode>>(() => new Set([initialMode]));
  const mounted = useRef(false);

  useEffect(() => {
    // Effects run twice in development (Strict Mode); count the view once.
    if (mounted.current) return;
    mounted.current = true;
    trackAddFarm("add_farm_view", { mode: initialMode });
    trackAddFarm("add_farm_step", { mode: initialMode, step: 1 });
  }, [initialMode]);

  function switchTo(next: AddFarmMode) {
    if (next === mode) return;
    setMode(next);
    if (!seen.has(next)) {
      setSeen(new Set(seen).add(next));
      trackAddFarm("add_farm_step", { mode: next, step: 1 });
    }
  }

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Vad vill du göra?" className="flex rounded-xl bg-stone-200/70 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.mode}
            type="button"
            role="tab"
            id={`tab-${tab.mode}`}
            aria-selected={mode === tab.mode}
            aria-controls={`panel-${tab.mode}`}
            onClick={() => switchTo(tab.mode)}
            className={`flex-1 min-h-11 rounded-lg px-2 text-sm font-medium transition-colors ${
              mode === tab.mode ? "bg-white text-stone-900 shadow-sm" : "text-stone-600 hover:text-stone-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div id="panel-owner" role="tabpanel" aria-labelledby="tab-owner" hidden={mode !== "owner"}>
        {seen.has("owner") && <OwnerForm onTip={() => switchTo("tip")} photosOpen={photosOpen} />}
      </div>
      <div id="panel-tip" role="tabpanel" aria-labelledby="tab-tip" hidden={mode !== "tip"}>
        {seen.has("tip") && <TipForm />}
      </div>
    </div>
  );
}
