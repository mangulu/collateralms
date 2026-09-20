'use client';
import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import CollateralRelationshipMap from './CollateralRelationshipMap';

interface Props {
  onClose: () => void;
}

const CARDS = [
  {
    num: '01',
    title: 'One borrower, many loans',
    body: "Kilimanjaro Traders holds two active facilities against a single credit relationship — a working-capital loan and a trade-finance loan.",
  },
  {
    num: '02',
    title: 'One loan, several assets',
    body: "Loan A doesn't rely on a single pledge — it's secured by both the warehouse and the delivery fleet, spreading the bank's risk.",
  },
  {
    num: '03',
    title: 'One asset, more than one loan',
    body: 'The delivery fleet backs both loans at once. Each claim is ranked — first charge, second charge — so it\'s clear who gets paid first if it\'s ever sold.',
  },
];

export default function CollateralRelationshipModal({ onClose }: Props) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(15,20,28,0.55)', backdropFilter: 'blur(2px)' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="How collateral, obligors and loans connect"
        className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl"
        style={{ backgroundColor: 'var(--izou-card)', boxShadow: '0 24px 60px rgba(15,20,28,0.35)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="p-6 sm:p-8"
          style={{ background: 'linear-gradient(135deg, var(--izou-secondary-light) 0%, var(--izou-card) 55%)' }}
        >
          <div className="flex items-start justify-between gap-4 mb-3">
            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--izou-primary)' }}>
              CollateralMS · how it connects
            </p>
            <button
              onClick={onClose}
              aria-label="Close"
              className="p-1.5 rounded-lg transition-colors shrink-0"
              style={{ color: 'var(--izou-muted)' }}
              onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0,0,0,0.06)'; }}
              onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
            >
              <X size={18} />
            </button>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold leading-tight mb-2" style={{ color: 'var(--izou-text)' }}>
            How one borrower's loans share a pool of collateral
          </h2>
          <p className="text-sm mb-6 max-w-2xl" style={{ color: 'var(--izou-muted)' }}>
            A plain-language look at how obligors, loans and pledged collateral relate in CollateralMS.
          </p>

          <CollateralRelationshipMap />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-6">
            {CARDS.map((card) => (
              <div
                key={card.num}
                className="rounded-xl p-4 flex flex-col gap-1.5"
                style={{ backgroundColor: 'var(--izou-bg)', border: '1px solid var(--izou-border)' }}
              >
                <span className="text-xs font-mono font-semibold" style={{ color: 'var(--izou-primary)' }}>{card.num}</span>
                <h3 className="text-sm font-bold" style={{ color: 'var(--izou-text)' }}>{card.title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--izou-muted)' }}>{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
