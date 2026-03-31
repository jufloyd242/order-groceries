'use client';

import { ComparisonSummary } from '@/types';
import { useState } from 'react';

interface CartActionsProps {
  summary: ComparisonSummary;
  onKrogerPush: () => Promise<void>;
  onAmazonPush: () => Promise<void>;
  includeAmazon: boolean;
}

export function CartActions({ summary, onKrogerPush, onAmazonPush, includeAmazon }: CartActionsProps) {
  const [krogerLoading, setKrogerLoading] = useState(false);
  const [amazonLoading, setAmazonLoading] = useState(false);

  async function handleKroger() {
    setKrogerLoading(true);
    try {
      await onKrogerPush();
    } finally {
      setKrogerLoading(false);
    }
  }

  async function handleAmazon() {
    setAmazonLoading(true);
    try {
      await onAmazonPush();
    } finally {
      setAmazonLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center', marginTop: 'var(--space-2xl)' }}>
      {/* King Soopers Action */}
      <div style={{ flex: 1, textAlign: 'center' }}>
        <button 
          className="btn btn-primary btn-lg" 
          style={{ width: '100%', marginBottom: 'var(--space-sm)' }}
          disabled={summary.krogerWins === 0 || krogerLoading}
          onClick={handleKroger}
        >
          {krogerLoading ? '🛒 Pushing...' : `🛒 Add to KS Cart (${summary.krogerWins} items)`}
        </button>
        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          Kroger Total: <span style={{ fontWeight: 600 }}>${summary.krogerCartTotal.toFixed(2)}</span>
        </div>
      </div>

      {/* Amazon Action */}
      <div style={{ flex: 1, textAlign: 'center', opacity: includeAmazon ? 1 : 0.5 }}>
        <button 
          className="btn btn-secondary btn-lg" 
          style={{ width: '100%', marginBottom: 'var(--space-sm)', border: '1px solid #ff9900', color: '#ff9900', cursor: includeAmazon ? 'pointer' : 'not-allowed' }}
          disabled={!includeAmazon || summary.amazonWins === 0 || amazonLoading}
          onClick={handleAmazon}
        >
          {!includeAmazon
            ? '🔍 Enable Amazon to compare'
            : amazonLoading
            ? '🛒 Pushing...'
            : `🛒 Add to Amazon Cart (${summary.amazonWins} items)`}
        </button>
        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          {includeAmazon
            ? <>Amazon Total: <span style={{ fontWeight: 600 }}>${summary.amazonCartTotal.toFixed(2)}</span></>
            : <span style={{ color: 'var(--text-muted)' }}>Toggle above to compare Amazon prices</span>}
        </div>
      </div>
    </div>
  );
}
