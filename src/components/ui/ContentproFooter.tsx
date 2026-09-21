'use client';
import React from 'react';

interface ContentproFooterProps {
  /** 'dark' renders on a dark/gradient background: brighter text, and the
   * logo sits on a white chip so its brand colors (which are tuned for a
   * light ground) stay fully legible instead of washing out. */
  variant?: 'light' | 'dark';
}

export default function ContentproFooter({ variant = 'light' }: ContentproFooterProps) {
  const isDark = variant === 'dark';
  return (
    <div className="mt-4 flex flex-col items-center gap-1.5">
      <div
        className="flex items-center gap-2 text-xs"
        style={{ color: isDark ? 'rgba(255,255,255,0.75)' : 'var(--izou-muted)' }}
      >
        <span>A product by</span>
        <a
          href="https://www.contentpro.co.tz"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Contentpro"
          className={`inline-flex items-center transition-opacity hover:opacity-100 ${isDark ? 'rounded-full bg-white px-3 py-1.5 shadow-sm' : 'opacity-90'}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/images/contentpro_logo.svg" alt="Contentpro" className={isDark ? 'h-5 w-auto' : 'h-4 w-auto'} />
        </a>
      </div>
    </div>
  );
}
