'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ComparisonResult, ComparisonSummary } from '@/types';
import { ComparisonRow } from '@/components/ComparisonRow';
import { CartActions } from '@/components/CartActions';
import { useCart } from '@/lib/cart/CartContext';
import { CartDrawer } from '@/components/CartDrawer';

const CACHE_KEY = 'sgo_comparison_cache';

export default function ComparePage() {
  const [results, setResults] = useState<ComparisonResult[]>([]);
  const [summary, setSummary] = useState<ComparisonSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const { addItem } = useCart();
  const router = useRouter();

  useEffect(() => {
    // Restore cached results immediately so the page isn't blank while fetching
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const { results: cachedResults, summary: cachedSummary } = JSON.parse(cached);
        setResults(cachedResults);
        setSummary(cachedSummary);
        setLoading(false);
      }
    } catch (_) {}
    fetchComparison();
  }, []);

  async function fetchComparison() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/compare');
      const data = await res.json();
      if (data.success) {
        // Filter out purchased items
        const filtered = data.results.filter((r: ComparisonResult) => r.item.status !== 'purchased');
        
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
        // Cache results for instant restore when navigating back
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ results: filtered, summary: summary }));
        } catch (_) {}
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
    // Clear cache so comparison re-fetches with updated preference
    try { sessionStorage.removeItem(CACHE_KEY); } catch (_) {}
    router.push(`/pick/${itemId}?store=${store}`);
  }

  async function handleKrogerPush() {
    const winners = results.filter((r) => r.selected_kroger?.upc);
    let added = 0;
    const addedListItemIds: string[] = [];
    for (const r of winners) {
      if (r.selected_kroger) {
        addItem(r.selected_kroger, r.item.quantity ?? 1, r.item.id);
        addedListItemIds.push(r.item.id);
        added++;
      }
    }
    if (added > 0) {
      setCartOpen(true);
      // Fire-and-forget: clean up list items and Todoist tasks
      if (addedListItemIds.length > 0) {
        fetch('/api/list/cleanup-on-cart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ listItemIds: addedListItemIds }),
        }).catch((err) => console.error('Cleanup-on-cart error:', err));
      }
    } else {
      alert('No King Soopers items with UPCs to add.');
    }
  }

  async function handleAmazonPush() {
    const winners = results.filter((r) => r.selected_amazon?.asin);
    let added = 0;
    const addedListItemIds: string[] = [];
    for (const r of winners) {
      if (r.selected_amazon) {
        addItem(r.selected_amazon, r.item.quantity ?? 1, r.item.id);
        addedListItemIds.push(r.item.id);
        added++;
      }
    }
    if (added > 0) {
      setCartOpen(true);
      // Fire-and-forget: clean up list items and Todoist tasks
      if (addedListItemIds.length > 0) {
        fetch('/api/list/cleanup-on-cart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ listItemIds: addedListItemIds }),
        }).catch((err) => console.error('Cleanup-on-cart error:', err));
      }
    } else {
      alert('No Amazon items to add.');
    }
  }

  if (loading) {
    return (
      <div className="container" style={{ textAlign: 'center', paddingTop: 'var(--space-2xl)' }}>
        <div style={{ fontSize: '3rem', marginBottom: 'var(--space-md)', animation: 'spin 2s linear infinite' }}>🛒</div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Comparing Prices...</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-sm)' }}>
          Searching King Soopers & Amazon for your items.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container" style={{ textAlign: 'center', paddingTop: 'var(--space-2xl)' }}>
        <div style={{ fontSize: '3rem', color: 'var(--accent-red)', marginBottom: 'var(--space-md)' }}>⚠️</div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Error Loading Comparison</h1>
        <p style={{ color: 'var(--accent-red)', marginTop: 'var(--space-sm)' }}>{error}</p>
        <button className="btn btn-primary" onClick={fetchComparison} style={{ marginTop: 'var(--space-md)' }}>Try Again</button>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingBottom: '120px' }}>
      <header className="page-header" style={{ marginBottom: 'var(--space-xl)', paddingTop: '2.5rem' }}>
        <div>
          <h1 className="page-title">📊 Price Comparison</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Comparing King Soopers & Amazon for {results.length} items.
          </p>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            💡 Note: Amazon pricing is currently unavailable. We're comparing King Soopers prices.
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-green)' }}>
            Total Savings: ${summary?.totalSavings.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Based on current best matches
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

      {/* Cart Actions */}
      {summary && (
        <CartActions 
          summary={summary} 
          onKrogerPush={handleKrogerPush} 
          onAmazonPush={handleAmazonPush} 
        />
      )}

      {/* Dashboard Footer / Home link */}
      <footer style={{ marginTop: 'var(--space-2xl)', textAlign: 'center' }}>
        <button className="btn btn-secondary" onClick={() => router.push('/')}>
          ← Back to Shopping List
        </button>
      </footer>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}
