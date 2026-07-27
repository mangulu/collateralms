'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Home } from 'lucide-react';

export default function NotFound() {
  const router = useRouter();

  const handleGoHome = () => {
    router?.push('/');
  };

  const handleGoBack = () => {
    if (typeof window !== 'undefined') {
      window.history?.back();
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ backgroundColor: 'var(--izou-bg)' }}
    >
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-6">
          <h1
            className="text-9xl font-bold"
            style={{ color: 'var(--izou-primary)', opacity: 0.2 }}
          >
            404
          </h1>
        </div>

        <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--izou-text)' }}>Page Not Found</h2>
        <p className="mb-8" style={{ color: 'var(--izou-muted)' }}>
          The page you&apos;re looking for doesn&apos;t exist. Let&apos;s get you back!
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={handleGoBack}
            className="izou-btn-primary inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold"
          >
            <ArrowLeft size={16} />
            Go Back
          </button>

          <button
            onClick={handleGoHome}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all"
            style={{
              backgroundColor: 'var(--izou-card)',
              border: '1px solid var(--izou-border)',
              color: 'var(--izou-text)',
            }}
            onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--izou-primary-light)'; }}
            onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--izou-card)'; }}
          >
            <Home size={16} />
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}