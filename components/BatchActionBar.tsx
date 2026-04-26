'use client';

import { useState } from 'react';

interface BatchActionBarProps {
  selectedCount: number;
  onSearch: (stores: ('kroger' | 'amazon')[]) => void;
  onCompare: (withAmazon: boolean) => void;
  onClear: () => void;
}

export function BatchActionBar({ selectedCount, onSearch, onCompare, onClear }: BatchActionBarProps) {
  const [kroger, setKroger] = useState(true);
  const [amazon, setAmazon] = useState(false);

  if (selectedCount === 0) return null;

  const activeStores = ([kroger ? 'kroger' : null, amazon ? 'amazon' : null] as const).filter(
    (s): s is 'kroger' | 'amazon' => s !== null
  );
  const multiStore = kroger && amazon;

  return (
    <div
      className="sticky top-16 z-40 bg-white/95 backdrop-blur-md border-b border-[#edeeef] px-4 py-3 flex items-center gap-3 flex-wrap shadow-[0_2px_15px_-3px_rgba(45,106,79,0.08)]"
      style={{ animation: 'slideDown 0.18s ease-out' }}
    >
      {/* Clear + count */}
      <div className="flex items-center gap-2">
        <button
          onClick={onClear}
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#bfc9c1] text-outline hover:text-error hover:border-error/40 transition-colors cursor-pointer bg-transparent"
          aria-label="Clear selection"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
        </button>
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-primary text-on-primary">
          {selectedCount} selected
        </span>
      </div>

      {/* Store toggles — chip pattern */}
      <div className="flex gap-2">
        <button
          onClick={() => setKroger((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150 cursor-pointer ${
            kroger
              ? 'bg-primary/10 text-primary border-primary/30'
              : 'bg-transparent text-outline border-[#bfc9c1] hover:border-primary/30'
          }`}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>store</span>
          King Soopers
        </button>
        <button
          onClick={() => setAmazon((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150 cursor-pointer ${
            amazon
              ? 'bg-amazon/10 text-amazon border-amazon/30'
              : 'bg-transparent text-outline border-[#bfc9c1] hover:border-amazon/30'
          }`}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>local_shipping</span>
          Amazon
        </button>
      </div>

      {/* Actions */}
      <div className="flex gap-2 ml-auto">
        <button
          disabled={activeStores.length === 0 || multiStore}
          onClick={() => onSearch(activeStores)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-primary text-on-primary rounded-xl shadow-[0_2px_0_0_rgba(0,0,0,0.1)] hover:bg-[#0d4430] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 cursor-pointer border-none"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>search</span>
          Search {selectedCount}
        </button>
        <button
          disabled={!multiStore}
          onClick={() => onCompare(amazon)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-white text-primary border-2 border-primary/15 rounded-xl hover:bg-primary/5 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 cursor-pointer"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>bar_chart</span>
          Compare {selectedCount}
        </button>
      </div>
    </div>
  );
}

