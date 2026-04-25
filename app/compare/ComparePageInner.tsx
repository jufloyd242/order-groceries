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
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 pt-16 text-center">
        <span className="material-symbols-outlined text-error" style={{ fontSize: '3rem' }}>error</span>
        <h1 className="text-xl font-semibold text-on-surface mt-4">Error Loading Comparison</h1>
        <p className="text-error mt-2">{error}</p>
        <button
          className="mt-4 px-4 py-2 bg-primary text-on-primary rounded-xl font-semibold text-sm border-none cursor-pointer hover:bg-[#0d4430] transition-colors"
          onClick={() => fetchComparison(includeAmazon)}
        >Try Again</button>
      </div>
    );
  }

  return (
    <div className="max-w-[1280px] mx-auto px-4 md:px-6 pb-32">
      <header className="flex items-start justify-between mb-8 pt-10">
        <div>
          <h1 className="text-3xl font-bold text-on-surface" style={{ fontFamily: 'var(--font-display)' }}>Price Comparison</h1>
          <p className="text-on-surface-variant mt-1">
            Comparing King Soopers{includeAmazon ? ' & Amazon' : ''} for{' '}
            {filteredIds ? `${results.length} selected item${results.length !== 1 ? 's' : ''}` : `${results.length} item${results.length !== 1 ? 's' : ''}`}.
          </p>
          <div className="mt-3">
            <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-on-surface">
              <input
                type="checkbox"
                checked={includeAmazon}
                onChange={(e) => {
                  const newValue = e.target.checked;
                  try { sessionStorage.removeItem(newValue ? CACHE_KEY_AMAZON : CACHE_KEY_KS); } catch (_) {}
                  setIncludeAmazon(newValue);
                  fetchComparison(newValue);
                }}
                className="w-4 h-4 cursor-pointer accent-primary"
              />
              Compare with Amazon <span className="text-outline font-normal">(slower)</span>
            </label>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-primary">
            {includeAmazon
              ? `Save $${summary?.totalSavings.toFixed(2)}`
              : `KS Total: $${summary?.krogerCartTotal.toFixed(2)}`}
          </div>
          <div className="text-xs text-outline mt-1">
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
            className="fixed bottom-24 right-4 z-[800] flex items-center gap-2 px-4 py-2.5 rounded-full border-none cursor-pointer text-sm font-bold text-on-primary whitespace-nowrap transition-all hover:scale-105 active:scale-95"
            style={{
              backgroundColor: optimized ? '#22c55e' : '#0f5238',
              boxShadow: '0 4px 16px rgba(15,82,56,0.4)',
            }}
            aria-label={`Optimize My Cart — add ${clearWinners.length} best-price items`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px', fontVariationSettings: "'FILL' 1" }}>
              {optimized ? 'check_circle' : 'auto_awesome'}
            </span>
            {optimized ? 'Cart Optimized!' : 'Optimize My Cart'}
            {!optimized && (
              <span className="bg-black/20 rounded-full px-2 py-0.5 text-xs">
                {clearWinners.length}
              </span>
            )}
          </button>
        );
      })()}

      {/* Dashboard Footer / Home link */}
      <footer className="mt-12 text-center">
        <button
          className="px-4 py-2 bg-white text-primary border-2 border-primary/15 rounded-xl font-semibold text-sm hover:bg-primary/5 transition-colors cursor-pointer"
          onClick={() => router.push('/')}
        >
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
    <div className="max-w-[1280px] mx-auto px-4 md:px-6 flex items-center justify-center min-h-[70vh]">
      <div
        className="bg-white rounded-2xl border border-[#edeeef] shadow-[0_2px_15px_-3px_rgba(45,106,79,0.08)]"
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
            background: 'linear-gradient(90deg, transparent, rgba(15,82,56,0.3), transparent)',
            borderRadius: '1px',
          }} />

          {/* Bouncing cart */}
          <div style={{
            position: 'absolute',
            bottom: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            lineHeight: 1,
            animation: 'cartBounce 1.6s ease-in-out infinite',
            userSelect: 'none',
            color: '#0f5238',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '3rem', fontVariationSettings: "'FILL' 1" }}>shopping_cart</span>
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
                background: 'rgba(15,82,56,0.18)',
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
        <h2 className="text-lg font-bold text-on-surface mb-1">
          {includeAmazon ? 'Comparing Prices…' : 'Fetching King Soopers Prices…'}
        </h2>

        {/* Rotating message */}
        <p
          key={msgIndex}
          className="text-sm text-on-surface-variant italic"
          style={{
            minHeight: '2.6em',
            margin: '0.75rem 0',
            animation: 'fadeMsg 3s ease-in-out forwards',
          }}
        >
          {messages[msgIndex]}
        </p>

        {/* Time warning */}
        {includeAmazon && (
          <p className="text-xs text-outline mt-4">
            Amazon lookups take 10–20 seconds.
          </p>
        )}
      </div>
    </div>
  );
}
