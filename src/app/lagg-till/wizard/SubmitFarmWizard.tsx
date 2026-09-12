"use client";

import { useEffect, useRef, useState } from "react";
import { trackAddFarm } from "../../../lib/analytics";
import OwnerForm from "./OwnerForm";
import TipForm from "./steps/TipForm";

type Mode = "owner" | "tip";

const TABS: { mode: Mode; label: string }[] = [
  { mode: "owner", label: "Jag driver gården" },
  { mode: "tip",   label: "Jag vill tipsa om en gård" },
];

/** The page's two sides: the owner's five steps, and a visitor's one-screen
 *  tip.  Both stay mounted so switching never loses what was typed; the
 *  owner side is what the entry links land on, `?tips=1` opens the other. */
export default function SubmitFarmWizard() {
  // null until the URL has been read on the client: the owner side is drawn
  // meanwhile (what the server rendered), but neither side counts as shown.
  const [mode, setMode] = useState<Mode | null>(null);
  const shownMode = mode ?? "owner";
  const mounted = useRef(false);

  useEffect(() => {
    // Effects run twice in development (Strict Mode); count the view once.
    if (mounted.current) return;
    mounted.current = true;
    const initial: Mode = new URLSearchParams(window.location.search).get("tips") === "1" ? "tip" : "owner";
    setMode(initial);
    trackAddFarm("add_farm_view", { mode: initial });
  }, []);

  function switchTo(next: Mode) {
    if (next === mode) return;
    setMode(next);
    if (next === "tip") trackAddFarm("add_farm_step", { mode: "tip", step: 1 });
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
            aria-selected={shownMode === tab.mode}
            aria-controls={`panel-${tab.mode}`}
            onClick={() => switchTo(tab.mode)}
            className={`flex-1 min-h-11 rounded-lg px-2 text-sm font-medium transition-colors ${
              shownMode === tab.mode ? "bg-white text-stone-900 shadow-sm" : "text-stone-600 hover:text-stone-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div id="panel-owner" role="tabpanel" aria-labelledby="tab-owner" hidden={shownMode !== "owner"}>
        <OwnerForm active={mode === "owner"} onTip={() => switchTo("tip")} />
      </div>
      <div id="panel-tip" role="tabpanel" aria-labelledby="tab-tip" hidden={shownMode !== "tip"}>
        <TipForm />
      </div>
    </div>
  );
}
