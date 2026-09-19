import type { LucideIcon } from "lucide-react";

// Shared chrome for the amber "us talking" cards (advertising, profile
// upgrade). Body content varies per callout; a callout with something to sell
// ends its children with <CalloutContactLink>, the tracked "Kontakta oss".
export default function Callout({
  icon: Icon,
  title,
  className,
  children,
}: {
  icon: LucideIcon;
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border border-amber-100 bg-amber-50 px-5 py-5 ${className ?? ""}`}
    >
      <div className="flex items-start gap-3">
        <Icon size={18} className="mt-0.5 shrink-0 text-amber-700" />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[15px] text-stone-900">{title}</h2>
          {children}
        </div>
      </div>
    </div>
  );
}
