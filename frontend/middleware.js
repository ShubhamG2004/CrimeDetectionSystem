import { NextResponse } from "next/server";

export function middleware(req) {
  const role = req.cookies.get("role")?.value;

  const url = req.nextUrl.pathname;

  if (url.startsWith("/dashboard/admin") && role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard/operator", req.url));
  }

  if (url.startsWith("/dashboard/operator") && role !== "operator") {
    return NextResponse.redirect(new URL("/dashboard/admin", req.url));
  }

  return NextResponse.next();
}
