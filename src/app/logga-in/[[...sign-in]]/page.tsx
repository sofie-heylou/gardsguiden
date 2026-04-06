import type { Metadata } from "next";
import SignInContent from "./sign-in-content";

export const metadata: Metadata = {
  title: "Logga in",
  robots: { index: false, follow: false },
};

export default function LoggaInPage() {
  return <SignInContent />;
}
