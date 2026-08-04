'use client';
import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle } from 'lucide-react';

interface ActionHelpIconProps {
  text: string;
  /** Tooltip position relative to the icon. Default: 'top' */
  position?: 'top' | 'bottom' | 'left' | 'right';
}

/**
 * Small inline help icon that shows a tooltip explaining what an action does.
 * Designed to sit next to workflow action buttons.
 */
export default function ActionHelpIcon({ text, position = 'top' }: ActionHelpIconProps) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!visible) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setVisible(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [visible]);

  const positionClasses: Record<string, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowClasses: Record<string, string> = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-gray-800 border-x-transparent border-b-transparent border-4',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-gray-800 border-x-transparent border-t-transparent border-4',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-gray-800 border-y-transparent border-r-transparent border-4',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-gray-800 border-y-transparent border-l-transparent border-4',
  };

  return (
    <span
      ref={ref}
      className="relative inline-flex items-center shrink-0"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onClick={(e) => { e.stopPropagation(); setVisible((v) => !v); }}
    >
      <HelpCircle
        size={14}
        className="text-white/70 hover:text-white cursor-help transition-colors"
        aria-label="Help"
      />
      {visible && (
        <span
          className={`absolute z-[9999] w-52 text-xs text-white bg-gray-800 rounded-lg px-3 py-2 shadow-lg pointer-events-none leading-relaxed ${positionClasses[position]}`}
          role="tooltip"
        >
          {text}
          <span className={`absolute ${arrowClasses[position]}`} />
        </span>
      )}
    </span>
  );
}
