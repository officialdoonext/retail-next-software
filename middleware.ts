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
  "/stores",
  "/sales",
  "/products",
  "/categories",
  "/variations",
  "/returns",
  "/stock",
  "/customers",
  "/discounts",
  "/vendors",
  "/staff",
  "/employees",
  "/settings",
  "/orders",
  "/inventory",
  "/stock-analysis",
  "/attendance-scan",
  "/analytics",
  "/utilities",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Skip static assets, Next internals, and public login assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth/send-otp") ||
    pathname.startsWith("/api/auth/verify-otp") ||
    pathname.startsWith("/api/auth/staff-login") ||
    pathname === "/favicon.ico" ||
    pathname === "/logo.jpeg" ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // 2. Extract and verify session token
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  let isAuthenticated = false;
  let sessionPayload: any = null;

  if (token) {
    try {
      const { payload } = await jwtVerify(token, SESSION_SECRET);
      isAuthenticated = true;
      sessionPayload = payload;
    } catch {
      isAuthenticated = false;
    }
  }

  // Compute plan validity from signed JWT token
  const isStatusActive = sessionPayload?.status?.toLowerCase() === "active";
  let expiryTime: number | null = null;
  if (sessionPayload?.expiryDate) {
    const t = new Date(sessionPayload.expiryDate).getTime();
    if (!isNaN(t)) expiryTime = t;
  }
  const isPlanValid = sessionPayload?.role === "Staff" ? true : isStatusActive && expiryTime !== null && expiryTime > Date.now();

  // 3. If user visits /login while already logged in, redirect based on plan validity
  if (pathname === "/login") {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL(isPlanValid ? "/dashboard" : "/onboarding", request.url));
    }
    return NextResponse.next();
  }

  // 4. If root path /, redirect based on auth status & plan validity
  if (pathname === "/") {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL(isPlanValid ? "/dashboard" : "/onboarding", request.url));
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

  // 6. Security Enforcement for Staff API Calls:
  // Staff accounts must never access staff management APIs
  if (sessionPayload?.role === "Staff") {
    if (pathname.startsWith("/api/staff")) {
      return NextResponse.json(
        { error: "Access denied. Staff members cannot manage staff accounts." },
        { status: 403 }
      );
    }
  }

  // 7. Strict Enforcement for Software Routes:
  const isSoftwareRoute = SOFTWARE_ROUTES.some((route) => pathname.startsWith(route));
  if (isSoftwareRoute) {
    // STRICT ZERO-FLASH BLOCK:
    // If Admin account is inactive, has no plan, or is expired, immediately redirect to /onboarding
    // The requested software page (e.g. /stores, /dashboard, etc.) is NEVER rendered or served!
    if (sessionPayload?.role === "Admin" && !isPlanValid) {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }

    // STRICT MODULE ACCESS FOR ADMIN/CLIENT:
    // If client has custom enabledModules configured by administrator, block disabled modules
    if (sessionPayload?.role === "Admin") {
      let activeModules: string[] | null = null;
      if (Array.isArray(sessionPayload.enabledModules)) {
        activeModules = sessionPayload.enabledModules;
      } else {
        const rawCookie = request.cookies.get("client_modules")?.value;
        if (rawCookie) {
          try {
            activeModules = JSON.parse(decodeURIComponent(rawCookie));
          } catch {}
        }
      }

      if (Array.isArray(activeModules)) {
        const ROUTE_MODULE_MAP: Record<string, string> = {
          "/pos": "pos",
          "/stores": "stores",
          "/sales": "sales-manager",
          "/categories": "product-manager",
          "/variations": "product-manager",
          "/products": "product-manager",
          "/returns": "return-exchange-manager",
          "/stock": "stock-manager",
          "/customers": "customer-manager",
          "/discounts": "discount-manager",
          "/vendors": "vendors-manager",
          "/staff": "staff-manager",
          "/employees": "employee-manager",
          "/attendance-scan": "employee-manager",
          "/orders": "sales-manager",
          "/inventory": "stock-manager",
          "/stock-analysis": "stock-manager",
        };

        const matchedModule = Object.entries(ROUTE_MODULE_MAP).find(
          ([prefix]) => pathname === prefix || pathname.startsWith(prefix + "/")
        );

        if (matchedModule) {
          const [, requiredModuleId] = matchedModule;
          if (!activeModules.includes(requiredModuleId)) {
            return NextResponse.redirect(new URL(`/unauthorized?module=${requiredModuleId}`, request.url));
          }
        }
      }
    }

    // STRICT PER-PAGE SECURITY FOR STAFF:
    if (sessionPayload?.role === "Staff") {
      const allowedAccess: string[] = Array.isArray(sessionPayload.access)
        ? sessionPayload.access
        : [];

      const isAllowed = allowedAccess.some(
        (allowed) => pathname === allowed || pathname.startsWith(allowed + "/")
      );

      if (!isAllowed) {
        return NextResponse.redirect(new URL("/unauthorized", request.url));
      }
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
