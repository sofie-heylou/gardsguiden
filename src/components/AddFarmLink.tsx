"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { trackAddFarm, type AddFarmSurface } from "../lib/analytics";

/** Every "Lägg till din gård" link goes through here so each one reports which
 *  surface it sits on — the only way to tell which entry point actually works. */
export default function AddFarmLink({
  surface,
  tips,
  className,
  onClick,
  children,
}: {
  surface: AddFarmSurface;
  /** Open the "tipsa om en gård" side of the page instead of the owner form. */
  tips?: boolean;
  className?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <Link
      href={tips ? "/lagg-till?tips=1" : "/lagg-till"}
      className={className}
      onClick={() => { onClick?.(); trackAddFarm("add_farm_clicked", { surface }); }}
    >
      {children}
    </Link>
  );
}
