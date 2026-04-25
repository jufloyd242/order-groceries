'use client';

import { useState, useEffect } from 'react';
import { ProductMatch } from '@/types';
import { ProductCard } from './SearchProductCard';

const PAGE_SIZE = 10;

interface SearchResultsProps {
  results: ProductMatch[];
  addedIds: Set<string>;
  selectedIds: Set<string>;
  onToggleSelect: (key: string) => void;
  loading?: boolean;
  rememberedKey?: string | null;
  onSelectRemember?: (key: string) => void;
  historicalAverages?: Record<string, number>;
}

export function SearchResults({ results, addedIds, selectedIds, onToggleSelect, loading, rememberedKey, onSelectRemember, historicalAverages }: SearchResultsProps) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [results]);

  if (loading) {
    return (
      <div className="text-center py-16 text-on-surface-variant">
        <span className="material-symbols-outlined text-outline" style={{ fontSize: '2.5rem', animation: 'spin 2s linear infinite' }}>search</span>
        <p className="mt-3 text-sm">Searching for products...</p>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-16 text-on-surface-variant">
        <p className="text-base">No products found</p>
      </div>
    );
  }

  const sorted = [...results].sort((a, b) => a.name.localeCompare(b.name));
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const slice = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <div className="grid gap-3 mb-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
        {slice.map((product) => {
          const key = `${product.store}-${product.id}`;
          return (
            <ProductCard
              key={key}
              product={product}
              isAdded={addedIds.has(key)}
              isSelected={selectedIds.has(key)}
              onToggleSelect={() => onToggleSelect(key)}
              isRemembered={rememberedKey === key}
              onSelectRemember={onSelectRemember ? () => onSelectRemember(key) : undefined}
              radioGroupName="remember-single"
              historicalAvg={historicalAverages?.[product.name] ?? null}
            />
          );
        })}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={() => setPage((p) => p - 1)}
            disabled={page <= 1}
            className={`px-4 py-1.5 rounded-lg text-sm border transition-colors ${
              page <= 1
                ? 'border-[#edeeef] text-outline cursor-default opacity-50'
                : 'border-[#edeeef] text-on-surface cursor-pointer hover:bg-surface-container-low'
            }`}
          >
            ← Prev
          </button>
          <span className="text-sm text-on-surface-variant min-w-[80px] text-center">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= totalPages}
            className={`px-4 py-1.5 rounded-lg text-sm border transition-colors ${
              page >= totalPages
                ? 'border-[#edeeef] text-outline cursor-default opacity-50'
                : 'border-[#edeeef] text-on-surface cursor-pointer hover:bg-surface-container-low'
            }`}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
