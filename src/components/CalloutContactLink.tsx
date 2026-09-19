"use client";

import Link from "next/link";
import { track } from "../lib/analytics";
import { pillBtnCls } from "../lib/ui";

// prefetch={false}: farm pages render this in-viewport for most visits, and the
// default prefetch would fetch /om's RSC payload on every view of a low-intent CTA.
export default function CalloutContactLink({
  event,
  eventParams,
}: {
  event: string;
  eventParams?: Record<string, unknown>;
}) {
  return (
    <Link
      href="/om#kontakt"
      prefetch={false}
      onClick={() => track(event, eventParams)}
      className={`mt-3 ${pillBtnCls}`}
    >
      Kontakta oss
    </Link>
  );
}
