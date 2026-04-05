import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "Logga in",
  robots: { index: false, follow: false },
};

export default function LoggaInPage() {
  return (
    <div className="h-full overflow-y-auto flex items-center justify-center py-12" style={{ background: "#FAFAF8" }}>
      <SignIn />
    </div>
  );
}
