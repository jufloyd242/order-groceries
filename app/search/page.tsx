'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ProductMatch } from '@/types';
import { SearchResults } from '@/components/SearchResults';

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<ProductMatch[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [storeChoice, setStoreChoice] = useState<'kroger' | 'amazon' | null>(null);
  const [addingToCart, setAddingToCart] = useState(false);

  // Auto-search if query in URL
  useEffect(() => {
    if (initialQuery) {
      handleSearch(initialQuery);
    }
  }, [initialQuery]);

  async function handleSearch(searchQuery: string) {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setResults([]);
    setSelectedIds(new Set());

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();

      if (data.success) {
        setResults(data.results);
      } else {
        alert('Search failed: ' + data.error);
      }
    } catch (err) {
      alert('Failed to search products');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function handleToggleSelect(productId: string) {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedIds(newSelected);
  }

  async function handleAddToCart(store: 'kroger' | 'amazon') {
    if (selectedIds.size === 0) {
      alert('Please select at least one product');
      return;
    }

    // Filter selected products by store
    const selectedProducts = results.filter((p) => {
      const key = `${p.store}-${p.id}`;
      return selectedIds.has(key) && p.store === store;
    });

    if (selectedProducts.length === 0) {
      alert(`No ${store === 'kroger' ? 'King Soopers' : 'Amazon'} products selected`);
      return;
    }

    setAddingToCart(true);

    try {
      if (store === 'kroger') {
        // Bulk add to Kroger cart
        const res = await fetch('/api/kroger/cart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: selectedProducts.map((p) => ({
              upc: p.upc,
              quantity: 1,
            })),
          }),
        });

        const data = await res.json();

        if (data.success) {
          // Delete list items matching the search query
          try {
            const deleteRes = await fetch('/api/list/delete-by-query', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                query: query.toLowerCase(),
              }),
            });

            if (!deleteRes.ok) {
              console.error('Failed to delete list items:', deleteRes.statusText);
            }
          } catch (err) {
            console.error('Error deleting list items:', err);
          }

          alert(`✅ Added ${selectedProducts.length} item(s) to King Soopers cart! Removing from list...`);

          // Redirect back home to see updated list
          router.push('/');
        } else if (res.status === 401 && data.authUrl) {
          window.location.href = data.authUrl;
        } else {
          alert('Failed to add to cart: ' + data.error);
        }
      } else {
        // Amazon: show link
        alert('Amazon cart push coming soon. Please add items manually to Amazon.');
      }
    } catch (err) {
      alert('Error adding to cart');
      console.error(err);
    } finally {
      setAddingToCart(false);
    }
  }

  const storeBreakdown = {
    kroger: results.filter((r) => r.store === 'kroger' && selectedIds.has(`${r.store}-${r.id}`)).length,
    amazon: results.filter((r) => r.store === 'amazon' && selectedIds.has(`${r.store}-${r.id}`)).length,
  };

  return (
    <div className="container" style={{ paddingBottom: '200px' }}>
      {/* Header */}
      <header className="page-header" style={{ marginBottom: 'var(--space-xl)', paddingTop: '2rem' }}>
        <button
          onClick={() => router.push('/')}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: '1.25rem',
            padding: '0.5rem 0',
            marginBottom: 'var(--space-md)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'color 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
        >
          ← Back to Home
        </button>
        <h1 className="page-title">🔍 Search Products</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Find and add multiple products from King Soopers and Amazon
        </p>
      </header>

      {/* Search Bar */}
      <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-2xl)' }}>
        <input
          type="text"
          placeholder="Search for products... (e.g., milk, bread, apples)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSearch(query);
            }
          }}
          className="ui-input"
          style={{ flex: 1, fontSize: '1rem', padding: 'var(--space-md)' }}
        />
        <button
          className="btn btn-primary btn-lg"
          onClick={() => handleSearch(query)}
          disabled={loading || !query.trim()}
          style={{ minWidth: 120 }}
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {/* Results Grid */}
      <SearchResults
        results={results}
        selectedIds={selectedIds}
        onToggleSelect={handleToggleSelect}
        loading={loading}
      />

      {/* Footer Action Bar (Sticky) */}
      {results.length > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'linear-gradient(180deg, transparent, rgba(15, 23, 42, 0.98))',
            padding: 'var(--space-2xl) var(--space-lg) var(--space-lg)',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            gap: 'var(--space-md)',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Selection Summary */}
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
              Selected: <strong>{selectedIds.size}</strong> product
              {selectedIds.size !== 1 ? 's' : ''}
            </p>
            {selectedIds.size > 0 && (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {storeBreakdown.kroger > 0 && `${storeBreakdown.kroger} King Soopers`}
                {storeBreakdown.kroger > 0 && storeBreakdown.amazon > 0 && ' • '}
                {storeBreakdown.amazon > 0 && `${storeBreakdown.amazon} Amazon`}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
            {storeBreakdown.kroger > 0 && (
              <button
                className="btn btn-primary btn-lg"
                onClick={() => handleAddToCart('kroger')}
                disabled={addingToCart}
                style={{ minWidth: 180 }}
              >
                {addingToCart ? '🛒 Adding...' : `🛒 Add to KS (${storeBreakdown.kroger})`}
              </button>
            )}
            {storeBreakdown.amazon > 0 && (
              <button
                className="btn btn-secondary btn-lg"
                onClick={() => handleAddToCart('amazon')}
                disabled={addingToCart}
                style={{ minWidth: 180, border: '1px solid #ff9900', color: '#ff9900' }}
              >
                {addingToCart ? '🛒 Adding...' : `🛒 Add to Amazon (${storeBreakdown.amazon})`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
