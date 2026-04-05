import type { Metadata } from "next";
import { SignUp } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "Skapa konto",
  robots: { index: false, follow: false },
};

export default function RegistreraPage() {
  return (
    <div className="h-full overflow-y-auto flex items-center justify-center py-12" style={{ background: "#FAFAF8" }}>
      <SignUp />
    </div>
  );
}
