import { NextResponse } from "next/server";

export function middleware(req) {
  const role = req.cookies.get("role")?.value;

  const url = req.nextUrl.pathname;

  if (url.startsWith("/dashboard/admin") && role !== "admin") {
    return NextResponse.redirect(new URL(role ? "/dashboard" : "/login", req.url));
  }

  if (url.startsWith("/dashboard/operator") && role !== "operator") {
    return NextResponse.redirect(new URL(role ? "/dashboard" : "/login", req.url));
  }

  if (url.startsWith("/field-operator") && role !== "field_operator") {
    return NextResponse.redirect(new URL(role ? "/dashboard" : "/login", req.url));
  }

  if (url.startsWith("/analytics") && role !== "admin") {
    return NextResponse.redirect(new URL(role ? "/dashboard" : "/login", req.url));
  }

  if (url.startsWith("/detect-image") && role !== "operator") {
    return NextResponse.redirect(new URL(role ? "/dashboard" : "/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/field-operator/:path*", "/analytics/:path*", "/detect-image/:path*"],
};
