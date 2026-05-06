import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

function getProjectRef(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  return url.match(/https:\/\/([^.]+)\./)?.[1] ?? '';
}

function injectTokenFromHeader(request: NextRequest): void {
  const token = request.headers.get('x-sb-token');
  if (!token) return;
  const hasCookie = request.cookies.getAll().some((c) => c.name.includes('auth-token'));
  if (hasCookie) return;
  request.cookies.set(`sb-${getProjectRef()}-auth-token`, token);
}

// Map routes to required permission keys (matches role_permissions seed data)
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

// Public routes that never require auth
const PUBLIC_ROUTES = ['/sign-up-login-screen', '/auth/callback'];

export async function middleware(request: NextRequest) {
  injectTokenFromHeader(request);
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Skip public routes
  if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
    return supabaseResponse;
  }

  // Skip API routes and static files
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico)$/)
  ) {
    return supabaseResponse;
  }

  // Redirect unauthenticated users to login
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = '/sign-up-login-screen';
    return NextResponse.redirect(url);
  }

  // Find the matching route permission requirement
  const matchedRoute = Object.keys(ROUTE_PERMISSIONS).find((route) =>
    pathname.startsWith(route)
  );

  if (!matchedRoute) {
    return supabaseResponse;
  }

  const requiredPermissions = ROUTE_PERMISSIONS[matchedRoute];

  // Fetch user role from user_profiles
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile) {
    const url = request.nextUrl.clone();
    url.pathname = '/sign-up-login-screen';
    return NextResponse.redirect(url);
  }

  const userRole = profile.role as string;

  // Fetch user's permissions for their role
  const { data: rolePerms } = await supabase
    .from('role_permissions')
    .select('permission_key')
    .eq('role_name', userRole);

  const permSet = new Set<string>(
    (rolePerms || []).map((rp: { permission_key: string }) => rp.permission_key)
  );

  // Check if user has at least one of the required permissions
  const hasAccess = requiredPermissions.some((perm) => permSet.has(perm));

  if (!hasAccess) {
    // Redirect to dashboard (or the first accessible page)
    const url = request.nextUrl.clone();
    url.pathname = '/collateral-dashboard';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
