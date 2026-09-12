"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { trackAddFarm, type AddFarmSurface } from "../lib/analytics";

/** Every "Lägg till din gård" link goes through here so each one reports which
 *  surface it sits on — the only way to tell which entry point actually works. */
export default function AddFarmLink({
  surface,
  className,
  onClick,
  children,
}: {
  surface: AddFarmSurface;
  className?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <Link
      href="/lagg-till"
      className={className}
      onClick={() => { onClick?.(); trackAddFarm("add_farm_clicked", { surface }); }}
    >
      {children}
    </Link>
  );
}
