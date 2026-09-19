'use client';
import React, { useEffect } from 'react';
import { fetchConfigByKey } from '@/lib/supabase/systemConfigService';

function parseHex(hex: string): [number, number, number] | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  return [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)];
}

function toHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

function hexToHsl(hex: string): string {
  const rgb = parseHex(hex);
  if (!rgb) return '';
  const [r0, g0, b0] = rgb;
  const r = r0 / 255, g = g0 / 255, b = b0 / 255;
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

/** Mixes `hex` toward `target` (white/black, usually) by `weight` (0–1). */
function mix(hex: string, target: [number, number, number], weight: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const [r, g, b] = rgb;
  const [tr, tg, tb] = target;
  return toHex(
    r + (tr - r) * weight,
    g + (tg - g) * weight,
    b + (tb - b) * weight
  );
}

function toRgba(hex: string, alpha: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
}

const WHITE: [number, number, number] = [255, 255, 255];
const BLACK: [number, number, number] = [0, 0, 0];

export default function BrandKitProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    async function applyBrandKit() {
      try {
        const brand = await fetchConfigByKey('brand_kit');
        if (!brand) return;
        const root = document.documentElement;

        const primary = String(brand.primary_color ?? '');
        const secondary = String(brand.secondary_color ?? '');
        const neutral = String(brand.neutral_color ?? '');
        const accent = String(brand.accent_color ?? '');
        const warning = String(brand.warning_color ?? '');
        const highlight = String(brand.highlight_color ?? '');
        const danger = String(brand.danger_color ?? '');

        if (primary && /^#[0-9a-f]{6}$/i.test(primary)) {
          root.style.setProperty('--izou-primary', primary);
          root.style.setProperty('--izou-primary-dark', mix(primary, BLACK, 0.22));
          root.style.setProperty('--izou-primary-light', mix(primary, WHITE, 0.88));
          root.style.setProperty('--izou-primary-tint', toRgba(primary, 0.12));
          root.style.setProperty('--izou-primary-tint-strong', toRgba(primary, 0.28));
          root.style.setProperty('--izou-primary-shadow', toRgba(primary, 0.25));
          root.style.setProperty('--primary', hexToHsl(primary));
          root.style.setProperty('--ring', hexToHsl(primary));
        }

        if (secondary && /^#[0-9a-f]{6}$/i.test(secondary)) {
          root.style.setProperty('--izou-secondary', secondary);
          root.style.setProperty('--izou-secondary-mid', mix(secondary, WHITE, 0.18));
          root.style.setProperty('--izou-secondary-end', mix(secondary, WHITE, 0.35));
          root.style.setProperty('--izou-secondary-light', mix(secondary, WHITE, 0.92));
          root.style.setProperty('--sidebar-bg', secondary);
        }

        if (neutral && /^#[0-9a-f]{6}$/i.test(neutral)) {
          root.style.setProperty('--izou-neutral', neutral);
          root.style.setProperty('--izou-muted', neutral);
          root.style.setProperty('--izou-text', mix(neutral, BLACK, 0.25));
          root.style.setProperty('--izou-border', mix(neutral, WHITE, 0.78));
        }

        if (accent && /^#[0-9a-f]{6}$/i.test(accent)) {
          root.style.setProperty('--izou-teal', accent);
          root.style.setProperty('--izou-success', accent);
          root.style.setProperty('--izou-success-light', mix(accent, WHITE, 0.9));
          root.style.setProperty('--accent', hexToHsl(accent));
          root.style.setProperty('--success', hexToHsl(accent));
        }

        if (warning && /^#[0-9a-f]{6}$/i.test(warning)) {
          root.style.setProperty('--izou-warning', warning);
          root.style.setProperty('--izou-warning-light', mix(warning, WHITE, 0.9));
          root.style.setProperty('--warning', hexToHsl(warning));
        }

        if (highlight && /^#[0-9a-f]{6}$/i.test(highlight)) {
          root.style.setProperty('--izou-highlight', highlight);
          root.style.setProperty('--izou-highlight-light', mix(highlight, WHITE, 0.9));
        }

        if (danger && /^#[0-9a-f]{6}$/i.test(danger)) {
          root.style.setProperty('--izou-danger', danger);
          root.style.setProperty('--izou-danger-light', mix(danger, WHITE, 0.9));
          root.style.setProperty('--destructive', hexToHsl(danger));
        }
      } catch {
        // silently fail — default CSS vars remain
      }
    }
    applyBrandKit();
  }, []);

  return <>{children}</>;
}
