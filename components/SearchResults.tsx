'use client';

import { ProductMatch } from '@/types';
import { ProductCard } from './SearchProductCard';

interface SearchResultsProps {
  results: ProductMatch[];
  selectedIds: Set<string>;
  onToggleSelect: (productId: string) => void;
  loading?: boolean;
}

export function SearchResults({
  results,
  selectedIds,
  onToggleSelect,
  loading,
}: SearchResultsProps) {
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

  // Group by store for display
  const krogerResults = results.filter((r) => r.store === 'kroger');
  const amazonResults = results.filter((r) => r.store === 'amazon');

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2xl)', marginBottom: 'var(--space-2xl)' }}>
      {/* Kroger Column */}
      <div>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 'var(--space-md)', color: '#b8d962' }}>
          KING SOOPERS ({krogerResults.length})
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--space-md)' }}>
          {krogerResults.map((product) => (
            <ProductCard
              key={`${product.store}-${product.id}`}
              product={product}
              isSelected={selectedIds.has(`${product.store}-${product.id}`)}
              onToggle={() => onToggleSelect(`${product.store}-${product.id}`)}
            />
          ))}
          {krogerResults.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 'var(--space-lg)' }}>
              No products found
            </div>
          )}
        </div>
      </div>

      {/* Amazon Column */}
      <div>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 'var(--space-md)', color: '#ff9900' }}>
          AMAZON ({amazonResults.length})
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--space-md)' }}>
          {amazonResults.map((product) => (
            <ProductCard
              key={`${product.store}-${product.id}`}
              product={product}
              isSelected={selectedIds.has(`${product.store}-${product.id}`)}
              onToggle={() => onToggleSelect(`${product.store}-${product.id}`)}
            />
          ))}
          {amazonResults.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 'var(--space-lg)' }}>
              No products available
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
