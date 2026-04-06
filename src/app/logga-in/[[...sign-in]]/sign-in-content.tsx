"use client";

import { SignIn, ClerkLoading, ClerkLoaded } from "@clerk/nextjs";

export default function SignInContent() {
  return (
    <div className="h-full overflow-y-auto flex items-center justify-center py-20" style={{ background: "#FAFAF8" }}>
      <ClerkLoading>
        <div className="w-96 h-96 rounded-2xl bg-stone-100 animate-pulse" />
      </ClerkLoading>
      <ClerkLoaded>
        <SignIn />
      </ClerkLoaded>
    </div>
  );
}
