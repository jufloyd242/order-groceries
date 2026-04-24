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

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        left: 0,
        right: 0,
        background: 'rgba(10, 10, 20, 0.85)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        zIndex: 40,
        animation: 'slideDown 0.18s ease-out',
      }}
    >
      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Clear selection */}
      <button
        onClick={onClear}
        title="Clear selection"
        style={{
          background: 'none',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '6px',
          color: 'var(--text-muted)',
          fontSize: '0.9rem',
          cursor: 'pointer',
          padding: '4px 8px',
          flexShrink: 0,
          lineHeight: 1,
          transition: 'all 0.15s',
        }}
        aria-label="Clear selection"
      >
        ✕
      </button>
      {/* Count badge */}
      <span
        style={{
          background: '#84cc16',
          color: '#0a0a0a',
          fontWeight: 700,
          fontSize: '0.85rem',
          borderRadius: '20px',
          padding: '3px 10px',
          flexShrink: 0,
        }}
      >
        {selectedCount} selected
      </span>

      {/* Store toggles */}
      <div style={{ display: 'flex', gap: '8px', flex: 1, flexWrap: 'wrap' }}>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
            fontSize: '0.85rem',
            color: kroger ? '#b8d962' : '#64748b',
            padding: '5px 10px',
            border: `1px solid ${kroger ? '#b8d962' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: '6px',
            background: kroger ? 'rgba(184, 217, 98, 0.08)' : 'none',
            transition: 'all 0.15s',
          }}
        >
          <input
            type="checkbox"
            checked={kroger}
            onChange={(e) => setKroger(e.target.checked)}
            style={{ accentColor: '#b8d962', width: 14, height: 14 }}
          />
          🟢 King Soopers
        </label>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
            fontSize: '0.85rem',
            color: amazon ? '#ff9900' : '#64748b',
            padding: '5px 10px',
            border: `1px solid ${amazon ? '#ff9900' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: '6px',
            background: amazon ? 'rgba(255, 153, 0, 0.08)' : 'none',
            transition: 'all 0.15s',
          }}
        >
          <input
            type="checkbox"
            checked={amazon}
            onChange={(e) => setAmazon(e.target.checked)}
            style={{ accentColor: '#ff9900', width: 14, height: 14 }}
          />
          🟠 Amazon
        </label>
      </div>

      {/* Search button */}
      <button
        className="btn btn-primary"
        disabled={activeStores.length === 0}
        onClick={() => onSearch(activeStores)}
        style={{
          padding: '10px 20px',
          fontSize: '0.9rem',
          fontWeight: 700,
          flexShrink: 0,
          opacity: activeStores.length === 0 ? 0.5 : 1,
        }}
      >
        🔍 Search {selectedCount} item{selectedCount !== 1 ? 's' : ''}
      </button>

      {/* Compare button — requires at least one second store (Amazon) to be meaningful */}
      <button
        className="btn btn-secondary"
        disabled={!amazon}
        onClick={() => onCompare(amazon)}
        style={{
          padding: '10px 20px',
          fontSize: '0.9rem',
          fontWeight: 700,
          flexShrink: 0,
          border: '1px solid rgba(255,255,255,0.2)',
          opacity: amazon ? 1 : 0.4,
          cursor: amazon ? 'pointer' : 'not-allowed',
        }}
      >
        📊 Compare Prices
      </button>
    </div>
  );
}
