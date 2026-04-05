'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ComparisonResult, ComparisonSummary } from '@/types';
import { ComparisonRow } from '@/components/ComparisonRow';
import { useCart } from '@/lib/cart/CartContext';

const CACHE_KEY_KS = 'sgo_cc_ks';
const CACHE_KEY_AMAZON = 'sgo_cc_amazon';

export default function ComparePageInner() {
  const [results, setResults] = useState<ComparisonResult[]>([]);
  const [summary, setSummary] = useState<ComparisonSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [includeAmazon, setIncludeAmazon] = useState(true);
  const [optimized, setOptimized] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addItem } = useCart();

  // Items filter from home page selection (e.g. /compare?ids=1,2,3)
  const idsParam = searchParams.get('ids') || '';
  const filteredIds = idsParam ? new Set(idsParam.split(',').filter(Boolean)) : null;
  // Amazon flag: URL param overrides default (default is true)
  const amazonParamRaw = searchParams.get('amazon');
  const amazonParam = amazonParamRaw !== null ? amazonParamRaw === 'true' : true;

  useEffect(() => {
    const withAmazon = amazonParam;
    setIncludeAmazon(withAmazon);
    // Only restore cache when showing the full list (no id filter)
    // Use the cache that matches the current Amazon state to avoid stale data.
    if (!filteredIds) {
      try {
        const cacheKey = withAmazon ? CACHE_KEY_AMAZON : CACHE_KEY_KS;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const { results: cachedResults, summary: cachedSummary } = JSON.parse(cached);
          setResults(cachedResults);
          setSummary(cachedSummary);
          setLoading(false);
        }
      } catch (_) {}
    }
    fetchComparison(withAmazon);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchComparison(withAmazon = false) {
    setLoading(true);
    setError(null);
    try {
      const apiParams = new URLSearchParams();
      if (withAmazon) apiParams.set('amazon', 'true');
      if (idsParam) apiParams.set('ids', idsParam);
      const url = `/api/compare?${apiParams}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        // Filter out purchased items — the API already scopes to selectedIds
        const filtered: ComparisonResult[] = data.results.filter(
          (r: ComparisonResult) => r.item.status !== 'purchased'
        );

        // Recalculate summary for filtered results
        const summary = {
          totalItems: filtered.length,
          krogerWins: filtered.filter((r: ComparisonResult) => r.winner === 'kroger').length,
          amazonWins: filtered.filter((r: ComparisonResult) => r.winner === 'amazon').length,
          ties: filtered.filter((r: ComparisonResult) => r.winner === 'tie').length,
          krogerCartTotal: filtered.reduce((sum: number, r: ComparisonResult) => sum + (r.selected_kroger?.price ?? 0) * (r.item.quantity ?? 1), 0),
          amazonCartTotal: filtered.reduce((sum: number, r: ComparisonResult) => sum + (r.selected_amazon?.price ?? 0) * (r.item.quantity ?? 1), 0),
          totalSavings: filtered.reduce((sum: number, r: ComparisonResult) => sum + (r.savings ?? 0), 0),
          unmappedCount: filtered.filter((r: ComparisonResult) => r.item.status === 'pending').length,
        };

        setResults(filtered);
        setSummary(summary);
        // Only cache when showing the full list (no id filter active) AND Kroger
        // returned at least some results. Caching a run where Kroger came back
        // empty (transient API error, bad location ID, etc.) would permanently
        // show $0 / no KS prices until the user manually refreshes.
        const krogerHasData = filtered.some(
          (r: ComparisonResult) => r.selected_kroger !== null || r.kroger.length > 0
        );
        if (!filteredIds && krogerHasData) {
          try {
            const cacheKey = withAmazon ? CACHE_KEY_AMAZON : CACHE_KEY_KS;
            sessionStorage.setItem(cacheKey, JSON.stringify({ results: filtered, summary }));
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
    // Clear both caches so comparison re-fetches with updated preference
    try {
      sessionStorage.removeItem(CACHE_KEY_KS);
      sessionStorage.removeItem(CACHE_KEY_AMAZON);
    } catch (_) {}
    // Carry the active ids + amazon context forward so the pick page can
    // reconstruct the exact same /compare URL on return.
    const returnParams = new URLSearchParams({ store });
    if (idsParam) returnParams.set('ids', idsParam);
    returnParams.set('amazon', String(includeAmazon));
    router.push(`/pick/${itemId}?${returnParams}`);
  }

  function optimizeCart() {
    const winners = results.filter(
      (r) => r.winner !== 'tie' && (r.selected_kroger !== null || r.selected_amazon !== null)
    );
    winners.forEach((r) => {
      if (r.winner === 'kroger' && r.selected_kroger) {
        addItem(r.selected_kroger, r.item.quantity ?? 1, r.item.id);
      } else if (r.winner === 'amazon' && r.selected_amazon) {
        addItem(r.selected_amazon, r.item.quantity ?? 1, r.item.id);
      }
    });
    setOptimized(true);
  }

  if (loading) {
    return <CompareLoadingScreen includeAmazon={includeAmazon} />;
  }

  if (error) {
    return (
      <div className="container" style={{ textAlign: 'center', paddingTop: 'var(--space-2xl)' }}>
        <div style={{ fontSize: '3rem', color: 'var(--accent-red)', marginBottom: 'var(--space-md)' }}>⚠️</div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Error Loading Comparison</h1>
        <p style={{ color: 'var(--accent-red)', marginTop: 'var(--space-sm)' }}>{error}</p>
        <button className="btn btn-primary" onClick={() => fetchComparison(includeAmazon)} style={{ marginTop: 'var(--space-md)' }}>Try Again</button>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingBottom: '120px' }}>
      <header className="page-header" style={{ marginBottom: 'var(--space-xl)', paddingTop: '2.5rem' }}>
        <div>
          <h1 className="page-title">📊 Price Comparison</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Comparing King Soopers{includeAmazon ? ' & Amazon' : ''} for{' '}
            {filteredIds ? `${results.length} selected item${results.length !== 1 ? 's' : ''}` : `${results.length} item${results.length !== 1 ? 's' : ''}`}.
          </p>
          <div style={{ marginTop: '0.75rem' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
              <input
                type="checkbox"
                checked={includeAmazon}
                onChange={(e) => {
                  const newValue = e.target.checked;
                  // Evict cache for the target state so we always fetch fresh data after toggle
                  try { sessionStorage.removeItem(newValue ? CACHE_KEY_AMAZON : CACHE_KEY_KS); } catch (_) {}
                  setIncludeAmazon(newValue);
                  fetchComparison(newValue);
                }}
                style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
              />
              🚀 Compare with Amazon <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(slower)</span>
            </label>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-green)' }}>
            {includeAmazon
              ? `Total Savings: $${summary?.totalSavings.toFixed(2)}`
              : `King Soopers Total: $${summary?.krogerCartTotal.toFixed(2)}`}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {includeAmazon ? 'Based on current best matches' : 'Toggle Amazon above to compare prices'}
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
            isAmazonSearched={includeAmazon}
          />
        ))}
      </div>

      {/* Optimize My Cart — floating button above the cart FAB */}
      {(() => {
        const clearWinners = results.filter(
          (r) => r.winner !== 'tie' && (r.selected_kroger !== null || r.selected_amazon !== null)
        );
        if (clearWinners.length < 2) return null;
        return (
          <button
            onClick={optimizeCart}
            style={{
              position: 'fixed',
              bottom: '96px',
              right: '16px',
              zIndex: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.6rem 1rem',
              borderRadius: '2rem',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 700,
              color: '#0f172a',
              backgroundColor: optimized ? '#4ade80' : '#84cc16',
              boxShadow: '0 4px 16px rgba(132,204,22,0.45)',
              transition: 'background-color 0.2s, transform 0.15s, box-shadow 0.15s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(132,204,22,0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(132,204,22,0.45)';
            }}
            aria-label={`Optimize My Cart — add ${clearWinners.length} best-price items`}
          >
            {optimized ? '✅' : '⚡'}
            {optimized ? 'Cart Optimized!' : `Optimize My Cart`}
            {!optimized && (
              <span style={{
                backgroundColor: 'rgba(0,0,0,0.15)',
                borderRadius: '1rem',
                padding: '0.1rem 0.45rem',
                fontSize: '0.75rem',
              }}>
                {clearWinners.length}
              </span>
            )}
          </button>
        );
      })()}

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

const AMAZON_MESSAGES = [
  'Galloping through the aisles to beat the Amazon delivery driver…',
  'Arguing with the self-checkout about an unexpected item in the bagging area…',
  'Scanning every barcode in existence. Please hold…',
  'Dispatching a drone to check Amazon\'s warehouse inventory…',
  'Consulting three different price-comparison spreadsheets simultaneously…',
];

export function CompareLoadingScreen({ includeAmazon }: { includeAmazon: boolean }) {
  const messages = includeAmazon ? AMAZON_MESSAGES : KS_MESSAGES;
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

          {/* Scanner beam (only when Amazon) */}
          {includeAmazon && (
            <div style={{
              position: 'absolute',
              left: '15%',
              right: '15%',
              height: '2px',
              background: 'linear-gradient(90deg, transparent, #84cc16, #ff9900, #84cc16, transparent)',
              borderRadius: '2px',
              animation: 'scanLine 1.8s ease-in-out infinite',
              boxShadow: '0 0 8px rgba(132,204,22,0.6)',
            }} />
          )}
        </div>

        {/* Title */}
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
          {includeAmazon ? '🔍 Comparing Prices…' : '🟢 Fetching King Soopers Prices…'}
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

        {/* Time warning */}
        {includeAmazon && (
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
            Amazon lookups take 10–20 seconds.
          </p>
        )}
      </div>
    </div>
  );
}
