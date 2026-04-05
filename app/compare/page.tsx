'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ComparisonResult, ComparisonSummary } from '@/types';
import { ComparisonRow } from '@/components/ComparisonRow';

const CACHE_KEY_KS = 'sgo_cc_ks';
const CACHE_KEY_AMAZON = 'sgo_cc_amazon';

export default function ComparePage() {
  const [results, setResults] = useState<ComparisonResult[]>([]);
  const [summary, setSummary] = useState<ComparisonSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [includeAmazon, setIncludeAmazon] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();

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
      const url = withAmazon ? '/api/compare?amazon=true' : '/api/compare';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        // Filter out purchased items, then apply id filter if coming from home page selection
        let filtered: ComparisonResult[] = data.results.filter(
          (r: ComparisonResult) => r.item.status !== 'purchased'
        );
        if (filteredIds && filteredIds.size > 0) {
          filtered = filtered.filter((r: ComparisonResult) => filteredIds.has(r.item.id));
        }
        
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
        // Only cache when showing the full list (no id filter active)
        if (!filteredIds) {
          try {
            const cacheKey = withAmazon ? CACHE_KEY_AMAZON : CACHE_KEY_KS;
            sessionStorage.setItem(cacheKey, JSON.stringify({ results: filtered, summary }));
          } catch (_) {}
        }
      } else {
        setError(data.error || 'Failed to fetch comparison');
      }
    } catch (err) {
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
    router.push(`/pick/${itemId}?store=${store}`);
  }

  if (loading) {
    return (
      <div className="container" style={{ textAlign: 'center', paddingTop: 'var(--space-2xl)' }}>
        <div style={{ fontSize: '3rem', marginBottom: 'var(--space-md)', animation: 'spin 2s linear infinite' }}>🛒</div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>{includeAmazon ? 'Comparing Prices...' : 'Fetching King Soopers Prices...'}</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-sm)' }}>
          {includeAmazon ? 'Comparing King Soopers & Amazon prices for your items.' : 'Fetching King Soopers prices for your items.'}
        </p>
        {includeAmazon && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 'var(--space-xs)' }}>
            Amazon lookups take 10–20 seconds.
          </p>
        )}
      </div>
    );
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

      {/* Dashboard Footer / Home link */}
      <footer style={{ marginTop: 'var(--space-2xl)', textAlign: 'center' }}>
        <button className="btn btn-secondary" onClick={() => router.push('/')}>
          ← Back to Inbox
        </button>
      </footer>
    </div>
  );
}
