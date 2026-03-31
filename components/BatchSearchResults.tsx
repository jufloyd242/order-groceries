'use client';

import { useState } from 'react';
import { ProductMatch } from '@/types';
import { ProductCard } from './SearchProductCard';

export interface BatchResultItem {
  itemId: string;
  query: string;
  kroger: ProductMatch[];
  amazon: ProductMatch[];
}

interface BatchSearchResultsProps {
  items: Array<{ id: string; raw_text: string }>;
  results: Map<string, BatchResultItem>;
  loadingIds: Set<string>;
  addedIds: Set<string>;
  selectedIds: Set<string>;
  onToggleSelect: (key: string, itemId: string) => void;
  /** Maps listItemId → product key selected as preference for that item */
  rememberedKeys: Map<string, string | null>;
  onSelectRemember: (key: string, itemId: string) => void;
  cartedItemIds: Set<string>;
  activeStore: 'kroger' | 'amazon' | 'both';
}

export function BatchSearchResults({
  items,
  results,
  loadingIds,
  addedIds,
  selectedIds,
  onToggleSelect,
  rememberedKeys,
  onSelectRemember,
  cartedItemIds,
  activeStore,
}: BatchSearchResultsProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function toggleCollapse(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      {items.map((item) => {
        const isLoading = loadingIds.has(item.id);
        const result = results.get(item.id);
        const isDone = cartedItemIds.has(item.id);
        const isOpen = !collapsed.has(item.id);

        const krogerProducts = result?.kroger ?? [];
        const amazonProducts = result?.amazon ?? [];
        const storeProducts =
          activeStore === 'kroger'
            ? krogerProducts
            : activeStore === 'amazon'
              ? amazonProducts
              : [...krogerProducts, ...amazonProducts];

        const totalCount = krogerProducts.length + amazonProducts.length;

        return (
          <div
            key={item.id}
            style={{
              border: isDone
                ? '1px solid rgba(34, 197, 94, 0.3)'
                : '1px solid rgba(255,255,255,0.08)',
              borderRadius: '10px',
              overflow: 'hidden',
              background: isDone ? 'rgba(34, 197, 94, 0.04)' : 'rgba(255,255,255,0.02)',
              transition: 'border-color 0.2s',
            }}
          >
            {/* Section Header */}
            <button
              onClick={() => toggleCollapse(item.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '14px 16px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              {/* Collapse arrow */}
              <span
                style={{
                  fontSize: '0.75rem',
                  color: '#64748b',
                  transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.15s',
                  flexShrink: 0,
                }}
              >
                ▶
              </span>

              {/* Item name */}
              <span
                style={{
                  fontWeight: 600,
                  fontSize: '1rem',
                  color: isDone ? '#22c55e' : '#f8fafc',
                  flex: 1,
                  textDecoration: isDone ? 'line-through' : 'none',
                  opacity: isDone ? 0.7 : 1,
                }}
              >
                {item.raw_text}
              </span>

              {/* Status */}
              {isDone ? (
                <span style={{ fontSize: '0.82rem', color: '#22c55e', flexShrink: 0 }}>✅ Added</span>
              ) : isLoading ? (
                <span style={{ fontSize: '0.82rem', color: '#64748b', flexShrink: 0 }}>🔍 Searching…</span>
              ) : result ? (
                <span style={{ fontSize: '0.8rem', color: '#94a3b8', flexShrink: 0 }}>
                  {totalCount} result{totalCount !== 1 ? 's' : ''}
                </span>
              ) : null}
            </button>

            {/* Section Body */}
            {isOpen && !isDone && (
              <div style={{ padding: '0 16px 16px' }}>
                {isLoading ? (
                  <div style={{ textAlign: 'center', padding: '24px', color: '#64748b', fontSize: '0.9rem' }}>
                    Searching for &ldquo;{item.raw_text}&rdquo;…
                  </div>
                ) : storeProducts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px', color: '#64748b', fontSize: '0.9rem' }}>
                    No products found for &ldquo;{item.raw_text}&rdquo;
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                    {/* KS sub-header when showing both stores */}
                    {activeStore === 'both' && krogerProducts.length > 0 && (
                      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#b8d962', marginBottom: '-4px', marginTop: '4px' }}>
                        🟢 King Soopers ({krogerProducts.length})
                      </div>
                    )}
                    {(activeStore === 'kroger' || activeStore === 'both') &&
                      krogerProducts.map((product) => {
                        const key = `${product.store}-${product.id}`;
                        return (
                          <ProductCard
                            key={key}
                            product={product}
                            isAdded={addedIds.has(key)}
                            isSelected={selectedIds.has(key)}
                            onToggleSelect={() => onToggleSelect(key, item.id)}
                            isRemembered={rememberedKeys.get(item.id) === key}
                            onSelectRemember={() => onSelectRemember(key, item.id)}
                            radioGroupName={`remember-${item.id}`}
                          />
                        );
                      })}

                    {/* Amazon sub-header when showing both stores */}
                    {activeStore === 'both' && amazonProducts.length > 0 && (
                      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#ff9900', marginBottom: '-4px', marginTop: '8px' }}>
                        🟠 Amazon ({amazonProducts.length})
                      </div>
                    )}
                    {(activeStore === 'amazon' || activeStore === 'both') &&
                      amazonProducts.map((product) => {
                        const key = `${product.store}-${product.id}`;
                        return (
                          <ProductCard
                            key={key}
                            product={product}
                            isAdded={addedIds.has(key)}
                            isSelected={selectedIds.has(key)}
                            onToggleSelect={() => onToggleSelect(key, item.id)}
                            isRemembered={rememberedKeys.get(item.id) === key}
                            onSelectRemember={() => onSelectRemember(key, item.id)}
                            radioGroupName={`remember-${item.id}`}
                          />
                        );
                      })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
