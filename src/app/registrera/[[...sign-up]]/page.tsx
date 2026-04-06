import type { Metadata } from "next";
import SignUpContent from "./sign-up-content";

export const metadata: Metadata = {
  title: "Skapa konto",
  robots: { index: false, follow: false },
};

export default function RegistreraPage() {
  return <SignUpContent />;
}
