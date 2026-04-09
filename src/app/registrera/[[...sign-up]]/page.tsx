import type { Metadata } from "next";
import { SignUp } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Skapa konto",
  robots: { index: false, follow: false },
};

export default async function RegistreraPage() {
  const user = await currentUser();
  if (user) redirect("/min-gard");

  return (
    <div className="h-full overflow-y-auto flex items-center justify-center py-12" style={{ background: "#FAFAF8" }}>
      <SignUp routing="path" path="/registrera" />
    </div>
  );
}
