import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SESSION_SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET || "7f68c5b058a9e623192083b38ef05ca7e3cf4d8c72877a5e0192e21bf18db35d"
);

const AUTH_COOKIE = "auth_session";
const ACTIVE_STORE_COOKIE = "active_store_id";

// Software routes that strictly require an active, selected store
const SOFTWARE_ROUTES = [
  "/dashboard",
  "/pos",
  "/products",
  "/inventory",
  "/categories",
  "/variations",
  "/orders",
  "/customers",
  "/employees",
  "/analytics",
  "/settings",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Skip static assets, Next internals, and public login assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth/send-otp") ||
    pathname.startsWith("/api/auth/verify-otp") ||
    pathname === "/favicon.ico" ||
    pathname === "/logo.jpeg" ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // 2. Extract and verify session token
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  let isAuthenticated = false;

  if (token) {
    try {
      await jwtVerify(token, SESSION_SECRET);
      isAuthenticated = true;
    } catch {
      isAuthenticated = false;
    }
  }

  // 3. If user visits /login while already logged in, redirect to /onboarding
  if (pathname === "/login") {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }
    return NextResponse.next();
  }

  // 4. If root path /, redirect based on auth status
  if (pathname === "/") {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 5. Strict Protection: Block unauthenticated users from ANY internal page
  if (!isAuthenticated) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized access blocked." }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // 6. If user is authenticated, check if accessing software pages without active store
  const isSoftwareRoute = SOFTWARE_ROUTES.some((route) => pathname.startsWith(route));
  if (isSoftwareRoute) {
    const activeStoreId = request.cookies.get(ACTIVE_STORE_COOKIE)?.value;
    if (!activeStoreId) {
      // Must select an active store on the onboarding page first
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     */
    "/((?!_next/static|_next/image).*)",
  ],
};
