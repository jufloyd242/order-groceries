'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ComparisonResult, ComparisonSummary } from '@/types';
import { ComparisonRow } from '@/components/ComparisonRow';

const CACHE_KEY_KS = 'sgo_cc_ks';

export default function ComparePageInner() {
  const [results, setResults] = useState<ComparisonResult[]>([]);
  const [summary, setSummary] = useState<ComparisonSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Items filter from home page selection (e.g. /compare?ids=1,2,3)
  const idsParam = searchParams.get('ids') || '';
  const filteredIds = idsParam ? new Set(idsParam.split(',').filter(Boolean)) : null;

  useEffect(() => {
    // Migration: purge stale Amazon-era cache key from older sessions
    try { sessionStorage.removeItem('sgo_cc_amazon'); } catch (_) {}

    // Only restore cache when showing the full list (no id filter)
    if (!filteredIds) {
      try {
        const cached = sessionStorage.getItem(CACHE_KEY_KS);
        if (cached) {
          const { results: cachedResults, summary: cachedSummary } = JSON.parse(cached);
          setResults(cachedResults);
          setSummary(cachedSummary);
          setLoading(false);
        }
      } catch (_) {}
    }
    fetchComparison();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchComparison() {
    setLoading(true);
    setError(null);
    try {
      const apiParams = new URLSearchParams();
      if (idsParam) apiParams.set('ids', idsParam);
      const url = `/api/compare?${apiParams}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        // Filter out purchased items and sanitize: Amazon fields must be empty
        const filtered: ComparisonResult[] = data.results
          .filter((r: ComparisonResult) => r.item.status !== 'purchased')
          .map((r: ComparisonResult) => ({
            ...r,
            amazon: [],
            selected_amazon: null,
            winner: r.winner === 'amazon' ? 'tie' : r.winner,
          }));

        // Recalculate summary for filtered results
        const summary = {
          totalItems: filtered.length,
          krogerWins: filtered.filter((r: ComparisonResult) => r.winner === 'kroger').length,
          amazonWins: 0,
          ties: filtered.filter((r: ComparisonResult) => r.winner === 'tie').length,
          krogerCartTotal: filtered.reduce((sum: number, r: ComparisonResult) => sum + (r.selected_kroger?.price ?? 0) * (r.item.quantity ?? 1), 0),
          amazonCartTotal: 0,
          totalSavings: 0,
          unmappedCount: filtered.filter((r: ComparisonResult) => r.item.status === 'pending').length,
        };
        setResults(filtered);
        setSummary(summary);
        // Only cache when showing the full list and Kroger returned results.
        const krogerHasData = filtered.some(
          (r: ComparisonResult) => r.selected_kroger !== null || r.kroger.length > 0
        );
        if (!filteredIds && krogerHasData) {
          try {
            sessionStorage.setItem(CACHE_KEY_KS, JSON.stringify({ results: filtered, summary }));
          } catch (_) {}
        }
      } else {
        setError(data.error || 'Failed to fetch comparison');
      }
    } catch (_err) {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }

  function handlePick(itemId: string, store: 'kroger' | 'amazon') {
    try { sessionStorage.removeItem(CACHE_KEY_KS); } catch (_) {}
    const returnParams = new URLSearchParams({ store });
    if (idsParam) returnParams.set('ids', idsParam);
    router.push(`/pick/${itemId}?${returnParams}`);
  }

  if (loading) {
    return <CompareLoadingScreen />;
  }

  if (error) {
    return (
      <div className="container" style={{ textAlign: 'center', paddingTop: 'var(--space-2xl)' }}>
        <div style={{ fontSize: '3rem', color: 'var(--accent-red)', marginBottom: 'var(--space-md)' }}>⚠️</div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Error Loading Comparison</h1>
        <p style={{ color: 'var(--accent-red)', marginTop: 'var(--space-sm)' }}>{error}</p>
        <button className="btn btn-primary" onClick={() => fetchComparison()} style={{ marginTop: 'var(--space-md)' }}>Try Again</button>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingBottom: '120px' }}>
      <header className="page-header" style={{ marginBottom: 'var(--space-xl)', paddingTop: '2.5rem' }}>
        <div>
          <h1 className="page-title">📊 Price Comparison</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            King Soopers prices for{' '}
            {filteredIds ? `${results.length} selected item${results.length !== 1 ? 's' : ''}` : `${results.length} item${results.length !== 1 ? 's' : ''}`}.
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-green)' }}>
            King Soopers Total: ${summary?.krogerCartTotal.toFixed(2)}
          </div>
        </div>
      </header>

      {/* Results List */}
      <div>
        {results.map((result) => (
          <ComparisonRow
            key={result.item.id}
            result={result}
            onPick={handlePick}
          />
        ))}
      </div>

      {/* Dashboard Footer / Home link */}
      <footer style={{ marginTop: 'var(--space-2xl)', textAlign: 'center' }}>
        <button className="btn btn-secondary" onClick={() => router.push('/')}>
          ← Back to Inbox
        </button>
      </footer>
    </div>
  );
}

// ─── Loading screen ───────────────────────────────────────────────────────────

const KS_MESSAGES = [
  'Checking the back of the shelf for the good milk…',
  'Negotiating bulk discounts with the produce section…',
  'Bribing the deli counter for priority pricing…',
  'Reorganizing the cereal aisle by vibes…',
  'Taste-testing every sample to ensure accuracy…',
];

export function CompareLoadingScreen() {
  const messages = KS_MESSAGES;
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setMsgIndex((i) => (i + 1) % messages.length);
    }, 3000);
    return () => clearInterval(id);
  }, [messages.length]);

  return (
    <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '70vh' }}>
      <div
        className="glass-card"
        style={{
          padding: '2.5rem 2rem',
          maxWidth: '420px',
          width: '100%',
          textAlign: 'center',
          animation: 'pulseGreen 3s ease-in-out infinite',
        }}
      >
        {/* Cart bounce animation */}
        <div style={{ position: 'relative', height: '90px', marginBottom: '1.5rem', overflow: 'hidden' }}>
          {/* Aisle floor line */}
          <div style={{
            position: 'absolute',
            bottom: '14px',
            left: '10%',
            right: '10%',
            height: '2px',
            background: 'linear-gradient(90deg, transparent, rgba(132,204,22,0.4), transparent)',
            borderRadius: '1px',
          }} />

          {/* Bouncing cart */}
          <div style={{
            position: 'absolute',
            bottom: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: '3rem',
            lineHeight: 1,
            animation: 'cartBounce 1.6s ease-in-out infinite',
            userSelect: 'none',
          }}>
            🛒
          </div>

          {/* Speed lines */}
          {[20, 35, 50, 65, 80].map((left, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                bottom: `${28 + (i % 3) * 8}px`,
                left: `${left}%`,
                width: `${10 + (i % 3) * 6}px`,
                height: '2px',
                background: 'rgba(132,204,22,0.25)',
                borderRadius: '1px',
                animation: `cartBounce ${1.6 + i * 0.1}s ease-in-out infinite`,
                animationDelay: `${i * 0.08}s`,
              }}
            />
          ))}
        </div>

        {/* Title */}
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
          🟢 Fetching King Soopers Prices…
        </h2>

        {/* Rotating message */}
        <p
          key={msgIndex}
          style={{
            fontSize: '0.9rem',
            color: 'var(--text-secondary)',
            minHeight: '2.6em',
            margin: '0.75rem 0',
            animation: 'fadeMsg 3s ease-in-out forwards',
            fontStyle: 'italic',
          }}
        >
          {messages[msgIndex]}
        </p>
      </div>
    </div>
  );
}
