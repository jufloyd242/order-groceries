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
    <div className="flex flex-col gap-4">
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
            className={`bg-white rounded-2xl border overflow-hidden shadow-[0_2px_15px_-3px_rgba(45,106,79,0.08)] transition-colors ${
              isDone ? 'border-[#22c55e]/30 bg-[#22c55e]/[0.02]' : 'border-[#edeeef]'
            }`}
          >
            {/* Section Header */}
            <button
              onClick={() => toggleCollapse(item.id)}
              className="w-full flex items-center gap-3 px-4 py-3 bg-primary/[0.04] border-b border-primary/10 text-left cursor-pointer hover:bg-primary/[0.07] transition-colors"
            >
              {/* Collapse arrow */}
              <span
                className="material-symbols-outlined text-outline flex-shrink-0 transition-transform duration-150"
                style={{ fontSize: '16px', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
              >
                chevron_right
              </span>

              {/* Item name */}
              <span
                className={`flex-1 font-semibold text-sm ${
                  isDone ? 'line-through text-outline' : 'text-on-surface'
                }`}
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {item.raw_text}
              </span>

              {/* Status / count badge */}
              {isDone ? (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-[#16a34a] bg-[#22c55e]/10 rounded-full px-2 py-0.5 flex-shrink-0">
                  <span className="material-symbols-outlined" style={{ fontSize: '12px', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  Added
                </span>
              ) : isLoading ? (
                <span className="flex items-center gap-1 text-[11px] font-medium text-outline flex-shrink-0">
                  <span className="material-symbols-outlined" style={{ fontSize: '13px', animation: 'spin 2s linear infinite' }}>search</span>
                  Searching…
                </span>
              ) : result ? (
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-on-primary text-[10px] font-bold flex-shrink-0">
                  {totalCount}
                </span>
              ) : null}
            </button>

            {/* Section Body */}
            {isOpen && !isDone && (
              <div className="p-4">
                {isLoading ? (
                  <div className="text-center py-10 text-on-surface-variant text-sm">
                    Searching for &ldquo;{item.raw_text}&rdquo;…
                  </div>
                ) : storeProducts.length === 0 ? (
                  <div className="text-center py-10 text-on-surface-variant text-sm">
                    No products found for &ldquo;{item.raw_text}&rdquo;
                  </div>
                ) : (
                  <div>
                    {/* KS sub-header when showing both stores */}
                    {activeStore === 'both' && krogerProducts.length > 0 && (
                      <p className="text-xs font-bold text-kroger mb-2 mt-0">
                        <span className="material-symbols-outlined align-middle mr-1" style={{ fontSize: '13px' }}>store</span>
                        King Soopers ({krogerProducts.length})
                      </p>
                    )}
                    <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
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
                    </div>

                    {/* Amazon sub-header when showing both stores */}
                    {activeStore === 'both' && amazonProducts.length > 0 && (
                      <p className="text-xs font-bold text-amazon mb-2 mt-2">
                        <span className="material-symbols-outlined align-middle mr-1" style={{ fontSize: '13px' }}>local_shipping</span>
                        Amazon ({amazonProducts.length})
                      </p>
                    )}
                    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
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
