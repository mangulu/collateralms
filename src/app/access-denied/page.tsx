'use client';
import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ShieldX, ArrowLeft, Network, Phone } from 'lucide-react';
import AppLogo from '@/components/ui/AppLogo';
import { useAuth } from '@/contexts/AuthContext';

function AccessDeniedContent() {
  const searchParams = useSearchParams();
  const reason = searchParams?.get('reason');
  const ip = searchParams?.get('ip');
  const { signOut } = useAuth();

  const isIpRestricted = reason === 'ip_restricted';

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ backgroundColor: 'var(--izou-bg)' }}
    >
      <div className="w-full max-w-md text-center">
        <div className="bg-white rounded-2xl shadow-xl p-10" style={{ border: '1px solid var(--izou-border)' }}>
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <AppLogo size={36} />
          </div>

          {/* Icon */}
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
            style={{ backgroundColor: '#fef2f2' }}
          >
            {isIpRestricted ? (
              <Network size={28} className="text-red-600" />
            ) : (
              <ShieldX size={28} className="text-red-600" />
            )}
          </div>

          <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--izou-text)' }}>
            {isIpRestricted ? 'Access Restricted' : 'Access Denied'}
          </h1>

          {isIpRestricted ? (
            <>
              <p className="text-sm mb-4" style={{ color: 'var(--izou-muted)' }}>
                Your current IP address is not on the approved whitelist for your role.
                Dashboard access for your role is limited to known office networks.
              </p>
              {ip && (
                <div
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl mb-5 text-sm font-mono"
                  style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}
                >
                  <Network size={14} />
                  Your IP: <strong>{ip}</strong>
                </div>
              )}
              <div
                className="text-left p-4 rounded-xl mb-6 space-y-2"
                style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe' }}
              >
                <p className="text-xs font-semibold text-blue-800">What to do:</p>
                <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                  <li>Connect to the office network or VPN</li>
                  <li>Contact your system administrator to whitelist your IP</li>
                  <li>Verify you are using an approved device</li>
                </ul>
              </div>
            </>
          ) : (
            <p className="text-sm mb-6" style={{ color: 'var(--izou-muted)' }}>
              You do not have permission to access this resource. Please contact your administrator.
            </p>
          )}

          <div className="flex flex-col gap-3">
            <button
              onClick={() => signOut()}
              className="izou-btn-primary w-full h-11 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
            >
              <ArrowLeft size={15} />
              Sign Out &amp; Return to Login
            </button>
            <a
              href="mailto:admin@eximbank.co.tz"
              className="w-full h-11 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors hover:bg-gray-50"
              style={{ border: '1px solid var(--izou-border)', color: 'var(--izou-muted)' }}
            >
              <Phone size={15} />
              Contact Administrator
            </a>
          </div>
        </div>

        <p className="mt-4 text-xs" style={{ color: 'var(--izou-muted)' }}>
          CollateralMS · EXIM Bank Tanzania
        </p>
      </div>
    </div>
  );
}

export default function AccessDeniedPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--izou-bg)' }}>
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <AccessDeniedContent />
    </Suspense>
  );
}
