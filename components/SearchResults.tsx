'use client';

import { useState, useEffect } from 'react';
import { ProductMatch } from '@/types';
import { ProductCard } from './SearchProductCard';

const PAGE_SIZE = 10;

interface SearchResultsProps {
  results: ProductMatch[];
  addedIds: Set<string>;
  onAddToCart: (product: ProductMatch) => void;
  loading?: boolean;
  rememberIds?: Set<string>;
  onToggleRemember?: (key: string) => void;
}

export function SearchResults({ results, addedIds, onAddToCart, loading, rememberIds, onToggleRemember }: SearchResultsProps) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [results]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--text-secondary)' }}>
        <div style={{ fontSize: '2rem', marginBottom: 'var(--space-md)', animation: 'spin 2s linear infinite' }}>
          🔍
        </div>
        <p>Searching for products...</p>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--text-secondary)' }}>
        <p style={{ fontSize: '1.1rem' }}>No products found</p>
      </div>
    );
  }

  const sorted = [...results].sort((a, b) => a.name.localeCompare(b.name));
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const slice = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
        {slice.map((product) => {
          const key = `${product.store}-${product.id}`;
          return (
            <ProductCard
              key={key}
              product={product}
              isAdded={addedIds.has(key)}
              onAddToCart={() => onAddToCart(product)}
              isRemembered={rememberIds?.has(key)}
              onToggleRemember={onToggleRemember ? () => onToggleRemember(key) : undefined}
            />
          );
        })}
      </div>
      {totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            marginTop: 'var(--space-lg)',
          }}
        >
          <button
            onClick={() => setPage((p) => p - 1)}
            disabled={page <= 1}
            style={{
              padding: '6px 14px', borderRadius: '6px', fontSize: '0.85rem',
              border: '1px solid rgba(255,255,255,0.12)',
              cursor: page <= 1 ? 'default' : 'pointer',
              background: 'none',
              color: page <= 1 ? '#475569' : '#e2e8f0',
              opacity: page <= 1 ? 0.5 : 1,
            }}
          >
            ← Prev
          </button>
          <span style={{ fontSize: '0.85rem', color: '#94a3b8', minWidth: '80px', textAlign: 'center' }}>
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= totalPages}
            style={{
              padding: '6px 14px', borderRadius: '6px', fontSize: '0.85rem',
              border: '1px solid rgba(255,255,255,0.12)',
              cursor: page >= totalPages ? 'default' : 'pointer',
              background: 'none',
              color: page >= totalPages ? '#475569' : '#e2e8f0',
              opacity: page >= totalPages ? 0.5 : 1,
            }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
