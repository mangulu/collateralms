'use client';
import React from 'react';

export default function ContentproFooter() {
  return (
    <div className="mt-4 flex flex-col items-center gap-1.5">
      <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--izou-muted)' }}>
        <span>A product by</span>
        <a
          href="https://www.contentpro.co.tz"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Contentpro"
          className="inline-flex items-center opacity-90 hover:opacity-100 transition-opacity"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/images/contentpro_logo.svg" alt="Contentpro" className="h-4 w-auto" />
        </a>
      </div>
      <p className="text-center text-[11px]" style={{ color: 'var(--izou-muted)' }}>
        Deployable for any bank
      </p>
    </div>
  );
}
