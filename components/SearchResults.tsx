'use client';

import { useState, useEffect } from 'react';
import { ProductMatch } from '@/types';
import { ProductCard } from './SearchProductCard';

const PAGE_SIZE = 10;

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
  const [krogerPage, setKrogerPage] = useState(1);
  const [amazonPage, setAmazonPage] = useState(1);

  // Reset to page 1 whenever results change (new search)
  useEffect(() => {
    setKrogerPage(1);
    setAmazonPage(1);
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

  const krogerAll = results.filter((r) => r.store === 'kroger');
  const amazonAll = results.filter((r) => r.store === 'amazon');

  const krogerTotalPages = Math.max(1, Math.ceil(krogerAll.length / PAGE_SIZE));
  const amazonTotalPages = Math.max(1, Math.ceil(amazonAll.length / PAGE_SIZE));

  const krogerSlice = krogerAll.slice((krogerPage - 1) * PAGE_SIZE, krogerPage * PAGE_SIZE);
  const amazonSlice = amazonAll.slice((amazonPage - 1) * PAGE_SIZE, amazonPage * PAGE_SIZE);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2xl)', marginBottom: 'var(--space-2xl)' }}>
      {/* Kroger Column */}
      <div>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 'var(--space-md)', color: '#b8d962' }}>
          KING SOOPERS ({krogerAll.length})
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--space-md)' }}>
          {krogerSlice.map((product) => (
            <ProductCard
              key={`${product.store}-${product.id}`}
              product={product}
              isSelected={selectedIds.has(`${product.store}-${product.id}`)}
              onToggle={() => onToggleSelect(`${product.store}-${product.id}`)}
            />
          ))}
          {krogerAll.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 'var(--space-lg)' }}>
              No products found
            </div>
          )}
        </div>
        {krogerTotalPages > 1 && (
          <PaginationControls
            page={krogerPage}
            totalPages={krogerTotalPages}
            onPageChange={setKrogerPage}
          />
        )}
      </div>

      {/* Amazon Column */}
      <div>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 'var(--space-md)', color: '#ff9900' }}>
          AMAZON ({amazonAll.length})
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--space-md)' }}>
          {amazonSlice.map((product) => (
            <ProductCard
              key={`${product.store}-${product.id}`}
              product={product}
              isSelected={selectedIds.has(`${product.store}-${product.id}`)}
              onToggle={() => onToggleSelect(`${product.store}-${product.id}`)}
            />
          ))}
          {amazonAll.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 'var(--space-lg)' }}>
              No products available
            </div>
          )}
        </div>
        {amazonTotalPages > 1 && (
          <PaginationControls
            page={amazonPage}
            totalPages={amazonTotalPages}
            onPageChange={setAmazonPage}
          />
        )}
      </div>
    </div>
  );
}

function PaginationControls({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: '12px', marginTop: 'var(--space-lg)',
    }}>
      <button
        onClick={() => onPageChange(page - 1)}
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
        onClick={() => onPageChange(page + 1)}
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
  );
}
