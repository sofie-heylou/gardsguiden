import type { Metadata } from "next";
import { Suspense } from "react";
import LoginFlow from "./LoginFlow";

export const metadata: Metadata = {
  title: "Logga in",
  robots: { index: false, follow: false },
};

export default function LoggaInPage() {
  return (
    <div className="h-full overflow-y-auto" style={{ background: "#FAFAF8" }}>
      <div className="max-w-sm mx-auto px-4 py-10">
        <Suspense>
          <LoginFlow />
        </Suspense>
      </div>
    </div>
  );
}
