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

// ─── Roles that require 2FA and IP restrictions ───────────────────────────────
const SENSITIVE_ROLES = new Set(['system_admin', 'supervisor']);

// ─── IP matching helper (CIDR and exact) ─────────────────────────────────────
function ipMatchesCidr(ip: string, cidr: string): boolean {
  try {
    if (!cidr.includes('/')) return ip.trim() === cidr.trim();
    const [network, prefixStr] = cidr.split('/');
    const prefix = parseInt(prefixStr, 10);
    const ipParts = ip.split('.').map(Number);
    const netParts = network.split('.').map(Number);
    if (ipParts.length !== 4 || netParts.length !== 4) return false;
    const ipNum = (ipParts[0] << 24) | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3];
    const netNum = (netParts[0] << 24) | (netParts[1] << 16) | (netParts[2] << 8) | netParts[3];
    const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    return (ipNum & mask) === (netNum & mask);
  } catch {
    return false;
  }
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    '127.0.0.1'
  );
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
  // Archive module
  '/archive/vault-management': ['collateral.view'],
  '/archive/collateral-placement': ['collateral.view'],
  '/archive/documents-library': ['collateral.view'],
  '/archive/request-workflow': ['collateral.view'],
  '/archive/custody-tracker': ['collateral.view'],
  '/archive/audit-log': ['audit_log.view'],
};

// Public routes that never require auth
const PUBLIC_ROUTES = ['/sign-up-login-screen', '/auth/callback', '/auth/reset-password', '/access-denied'];

// Authenticated-but-no-permission-check routes
const AUTH_ONLY_ROUTES = ['/module-hub'];

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

  let user: any = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data?.user ?? null;
  } catch {
    user = null;
  }

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

  // Fetch user profile (role + 2FA status)
  let profile: any = null;
  try {
    const { data } = await supabase
      .from('user_profiles')
      .select('role, two_fa_enabled, two_fa_enforced')
      .eq('id', user.id)
      .single();
    profile = data ?? null;
  } catch {
    profile = null;
  }

  if (!profile) {
    const url = request.nextUrl.clone();
    url.pathname = '/sign-up-login-screen';
    return NextResponse.redirect(url);
  }

  const userRole = profile.role as string;
  const isSensitiveRole = SENSITIVE_ROLES.has(userRole);

  // ─── 2FA enforcement: redirect to login if 2FA not set up for sensitive roles ─
  // The login flow handles 2FA challenge; here we just ensure 2FA is enabled
  // for sensitive roles. If not, redirect to login with a flag.
  if (isSensitiveRole && !profile.two_fa_enabled) {
    const url = request.nextUrl.clone();
    url.pathname = '/sign-up-login-screen';
    url.searchParams.set('require_2fa_setup', '1');
    return NextResponse.redirect(url);
  }

  // ─── IP-based session restriction for sensitive roles ─────────────────────
  if (isSensitiveRole) {
    const clientIp = getClientIp(request);

    // Fetch active IP whitelist entries that apply to this role
    let allowedEntries: any[] = [];
    try {
      const { data } = await supabase
        .from('ip_whitelist_configs')
        .select('ip_address, applies_to')
        .eq('is_active', true);
      allowedEntries = (data ?? []).filter((entry: any) =>
        Array.isArray(entry.applies_to) && entry.applies_to.includes(userRole)
      );
    } catch {
      allowedEntries = [];
    }

    // If whitelist is configured, enforce it
    if (allowedEntries.length > 0) {
      const isAllowed = allowedEntries.some((entry: any) =>
        ipMatchesCidr(clientIp, entry.ip_address)
      );

      if (!isAllowed) {
        // Log the blocked access attempt (best-effort, non-blocking)
        try {
          await supabase.from('ip_access_log').insert({
            user_id: user.id,
            ip_address: clientIp,
            user_role: userRole,
            access_result: 'blocked',
            route: pathname,
          });
        } catch {
          // Non-critical — don't block the redirect
        }

        const url = request.nextUrl.clone();
        url.pathname = '/access-denied';
        url.searchParams.set('reason', 'ip_restricted');
        url.searchParams.set('ip', clientIp);
        return NextResponse.redirect(url);
      }

      // Log allowed access (best-effort)
      try {
        await supabase.from('ip_access_log').insert({
          user_id: user.id,
          ip_address: clientIp,
          user_role: userRole,
          access_result: 'allowed',
          route: pathname,
        });
      } catch {
        // Non-critical
      }
    }
  }

  // Auth-only routes — no permission check needed
  if (AUTH_ONLY_ROUTES.some((r) => pathname.startsWith(r))) {
    return supabaseResponse;
  }

  // Find the matching route permission requirement
  const matchedRoute = Object.keys(ROUTE_PERMISSIONS).find((route) =>
    pathname.startsWith(route)
  );

  if (!matchedRoute) {
    return supabaseResponse;
  }

  const requiredPermissions = ROUTE_PERMISSIONS[matchedRoute];

  // Fetch user's permissions for their role
  let rolePerms: any[] = [];
  try {
    const { data } = await supabase
      .from('role_permissions')
      .select('permission_key')
      .eq('role_name', userRole);
    rolePerms = data ?? [];
  } catch {
    rolePerms = [];
  }

  const permSet = new Set<string>(
    rolePerms.map((rp: { permission_key: string }) => rp.permission_key)
  );

  const hasAccess = requiredPermissions.some((perm) => permSet.has(perm));

  if (!hasAccess) {
    const url = request.nextUrl.clone();
    url.pathname = '/module-hub';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
