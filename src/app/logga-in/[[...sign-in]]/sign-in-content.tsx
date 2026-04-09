"use client";

import { SignIn } from "@clerk/nextjs";

export default function SignInContent() {
  return (
    <div className="h-full overflow-y-auto flex items-center justify-center py-20" style={{ background: "#FAFAF8" }}>
      <SignIn />
    </div>
  );
}
