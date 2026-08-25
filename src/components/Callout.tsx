import type { LucideIcon } from "lucide-react";
import CalloutContactLink from "./CalloutContactLink";

// Shared shell for the amber "us talking" cards (advertising, profile upgrade).
// Body content varies per callout; the card chrome and the tracked contact CTA
// stay identical everywhere.
export default function Callout({
  icon: Icon,
  title,
  event,
  eventParams,
  className,
  children,
}: {
  icon: LucideIcon;
  title: string;
  event: string;
  eventParams?: Record<string, unknown>;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border border-amber-100 bg-amber-50 px-5 py-5 ${className ?? ""}`}
    >
      <div className="flex items-start gap-3">
        <Icon size={18} className="mt-0.5 shrink-0 text-amber-700" />
        <div>
          <h2 className="font-display text-[15px] text-stone-900">{title}</h2>
          {children}
          <CalloutContactLink event={event} eventParams={eventParams} />
        </div>
      </div>
    </div>
  );
}
