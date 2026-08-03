'use client';
import React from 'react';
import Link from 'next/link';
import { MapPin, CheckCircle2, ChevronRight } from 'lucide-react';
import { CollateralRecord } from '@/lib/supabase/collateralService';

function SectionHeader({ title, icon: IconComponent }: { title: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
        {IconComponent && React.createElement(IconComponent, { size: 14, className: 'text-primary' })}
      </div>
      <h2 className="text-sm font-700 text-foreground uppercase tracking-wider">{title}</h2>
    </div>
  );
}

export default function GeoSection({ collateral }: { collateral: CollateralRecord }) {
  const hasCoords = collateral.latitude != null && collateral.longitude != null;

  // OpenStreetMap embed — no API key required
  const osmSrc = hasCoords
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${(collateral.longitude! - 0.01).toFixed(6)},${(collateral.latitude! - 0.01).toFixed(6)},${(collateral.longitude! + 0.01).toFixed(6)},${(collateral.latitude! + 0.01).toFixed(6)}&layer=mapnik&marker=${collateral.latitude!.toFixed(6)},${collateral.longitude!.toFixed(6)}`
    : null;

  return (
    <div className="bg-white rounded-xl border border-border shadow-card p-5">
      <SectionHeader title="Geolocation" icon={MapPin} />
      {hasCoords && (
        <div className="flex items-center gap-2 mb-3 p-2.5 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle2 size={13} className="text-green-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-600 text-green-800 truncate">
              {collateral.locationAddress ?? `${collateral.latitude?.toFixed(6)}, ${collateral.longitude?.toFixed(6)}`}
            </p>
            <p className="text-[10px] text-green-700 font-mono">
              {collateral.latitude?.toFixed(6)}, {collateral.longitude?.toFixed(6)}
            </p>
          </div>
        </div>
      )}
      <div className="rounded-lg overflow-hidden border border-border bg-muted/30">
        {osmSrc ? (
          <iframe
            title="Collateral Location"
            width="100%"
            height="280"
            style={{ border: 0 }}
            loading="lazy"
            allowFullScreen
            src={osmSrc}
          />
        ) : (
          <div className="h-64 flex flex-col items-center justify-center gap-3 text-center px-6">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <MapPin size={22} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-600 text-foreground">No Coordinates Stored</p>
              <p className="text-xs text-muted-foreground mt-1">
                Use the Location Picker when editing this collateral to pin its exact location on the map.
              </p>
            </div>
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <MapPin size={12} />
          <span>{hasCoords ? 'Pinned location stored in database' : 'Asset location not yet geo-tagged'}</span>
        </div>
        <Link
          href="/geomapping"
          className="flex items-center gap-1.5 text-xs text-primary hover:underline font-500"
        >
          View in Geomapping Module <ChevronRight size={12} />
        </Link>
      </div>
    </div>
  );
}
