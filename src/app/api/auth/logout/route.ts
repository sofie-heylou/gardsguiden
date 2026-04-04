import { NextRequest, NextResponse } from "next/server";
import { deleteSession, COOKIE_NAME } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

export function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;

  if (token) {
    deleteSession(token);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  return response;
}
