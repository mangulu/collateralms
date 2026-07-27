'use client';
import React, { useEffect } from 'react';
import { fetchConfigByKey } from '@/lib/supabase/systemConfigService';

function hexToHsl(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '';
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export default function BrandKitProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    async function applyBrandKit() {
      try {
        const brand = await fetchConfigByKey('brand_kit');
        if (!brand) return;
        const root = document.documentElement;
        const primary = String(brand.primary_color ?? '');
        const accent = String(brand.accent_color ?? '');
        if (primary && /^#[0-9a-f]{6}$/i.test(primary)) {
          const hsl = hexToHsl(primary);
          root.style.setProperty('--primary', hsl);
          root.style.setProperty('--ring', hsl);
          // Also update IZOU CSS variables for full theme consistency
          root.style.setProperty('--izou-primary', primary);
        }
        if (accent && /^#[0-9a-f]{6}$/i.test(accent)) {
          root.style.setProperty('--accent', hexToHsl(accent));
          root.style.setProperty('--izou-teal', accent);
        }
      } catch {
        // silently fail — default CSS vars remain
      }
    }
    applyBrandKit();
  }, []);

  return <>{children}</>;
}
