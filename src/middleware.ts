import { NextResponse, type NextRequest } from 'next/server';

// Map routes to required permission keys
const ROUTE_PERMISSIONS: Record<string, string[]> = {
  '/collateral-dashboard': ['dashboard.view'],
  '/portfolio-monitoring': ['dashboard.view'],
  '/collateral-management': ['collateral.view'],
  '/collateral-detail': ['collateral.view'],
  '/perfection-workflow': ['perfection.view'],
  '/collateral-documents': ['collateral.view'],
  '/batch-release': ['collateral.edit'],
  '/bulk-upload': ['collateral.edit'],
  '/scheduled-jobs': ['collateral.edit'],
  '/fraud-prevention': ['compliance.view'],
  '/risk-assessment': ['compliance.view'],
  '/fast-track': ['collateral.view'],
  '/geomapping': ['collateral.view'],
  '/compliance-rules': ['compliance.view'],
  '/compliance-audit': ['compliance.view'],
  '/notifications-hub': ['dashboard.view'],
  '/alerts-inbox': ['dashboard.view'],
  '/alerts-delivery': ['dashboard.view'],
  '/live-activity': ['audit_log.view'],
  '/audit-trail': ['audit_log.view'],
  '/audit-log': ['audit_log.view'],
  '/activity-log': ['audit_log.view'],
  '/audit-report': ['audit_log.view'],
  '/reports': ['reports.view'],
  '/reports-dashboard': ['reports.view'],
  '/export': ['reports.view'],
  '/user-management': ['user_management.view'],
  '/admin': ['user_management.view'],
  '/settings': ['settings.view'],
};

// Permissions seeded per role (mirrors localUserStore SEED_ROLE_PERMISSIONS)
const ROLE_PERMISSIONS: Record<string, string[]> = {
  credit_officer: [
    'dashboard.view',
    'collateral.view',
    'collateral.create',
    'collateral.edit',
    'perfection.view',
    'perfection.submit',
    'compliance.view',
    'reports.view',
    'settings.view',
  ],
  legal_officer: [
    'dashboard.view',
    'collateral.view',
    'collateral.edit',
    'collateral.delete',
    'perfection.view',
    'perfection.review',
    'compliance.view',
    'audit_log.view',
    'reports.view',
    'settings.view',
  ],
  system_admin: [
    'dashboard.view',
    'collateral.view',
    'collateral.create',
    'collateral.edit',
    'collateral.delete',
    'perfection.view',
    'perfection.submit',
    'perfection.review',
    'compliance.view',
    'audit_log.view',
    'reports.view',
    'user_management.view',
    'user_management.manage',
    'settings.view',
    'settings.manage',
    'roles.view',
    'roles.manage',
  ],
};

// Public routes that never require auth
const PUBLIC_ROUTES = ['/sign-up-login-screen', '/auth/callback'];

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Skip public routes
  if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.next();
  }

  // Skip API routes and static files
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico)$/)
  ) {
    return NextResponse.next();
  }

  // Read local session cookie
  const sessionCookie = request.cookies.get('cms_local_session_cookie');
  if (!sessionCookie?.value) {
    const url = request.nextUrl.clone();
    url.pathname = '/sign-up-login-screen';
    return NextResponse.redirect(url);
  }

  let role: string | null = null;
  try {
    const session = JSON.parse(sessionCookie.value);
    role = session?.role ?? null;
  } catch {
    const url = request.nextUrl.clone();
    url.pathname = '/sign-up-login-screen';
    return NextResponse.redirect(url);
  }

  if (!role) {
    const url = request.nextUrl.clone();
    url.pathname = '/sign-up-login-screen';
    return NextResponse.redirect(url);
  }

  // Find the matching route permission requirement
  const matchedRoute = Object.keys(ROUTE_PERMISSIONS).find((route) =>
    pathname.startsWith(route)
  );

  if (!matchedRoute) {
    return NextResponse.next();
  }

  const requiredPermissions = ROUTE_PERMISSIONS[matchedRoute];
  const userPermissions = new Set<string>(ROLE_PERMISSIONS[role] ?? []);

  const hasAccess = requiredPermissions.some((perm) => userPermissions.has(perm));

  if (!hasAccess) {
    const url = request.nextUrl.clone();
    url.pathname = '/collateral-dashboard';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
