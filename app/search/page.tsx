'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ProductMatch } from '@/types';
import { SearchResults } from '@/components/SearchResults';
import { BatchSearchResults, BatchResultItem } from '@/components/BatchSearchResults';
import { useCart } from '@/lib/cart/CartContext';

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const itemId = searchParams.get('itemId') || '';
  const initialQuery = searchParams.get('q') || '';
  const mode = searchParams.get('mode') || '';
  const batchIdsParam = searchParams.get('ids') || '';
  const batchStoresParam = searchParams.get('stores') || 'kroger';
  const batchStores = batchStoresParam.split(',').filter(Boolean) as ('kroger' | 'amazon')[];

  const [query, setQuery] = useState(initialQuery);
  const [activeStore, setActiveStore] = useState<'kroger' | 'amazon'>('kroger');
  const [krogerResults, setKrogerResults] = useState<ProductMatch[]>([]);
  const [amazonResults, setAmazonResults] = useState<ProductMatch[]>([]);
  const [loadingKroger, setLoadingKroger] = useState(false);
  const [loadingAmazon, setLoadingAmazon] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [locationId, setLocationId] = useState('');
  const [zipCode, setZipCode] = useState('80516');
  const { addItem } = useCart();
  const [itemRawText, setItemRawText] = useState('');
  const [itemQuantity, setItemQuantity] = useState(1);
  const [itemPreference, setItemPreference] = useState<{ preferred_upc?: string | null; preferred_asin?: string | null; display_name?: string } | null>(null);
  const [historicalAverages, setHistoricalAverages] = useState<Record<string, number>>({});
  // Selected product keys for cart (checkbox state)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // For single-item mode: which product key is radioed as the remembered preference
  const [rememberedKey, setRememberedKey] = useState<string | null>(null);

  // Auto-fill remembered radio when results load and this item has a saved preference
  useEffect(() => {
    if (!itemPreference || rememberedKey) return;
    const allResults = [...krogerResults, ...amazonResults];
    if (allResults.length === 0) return;
    const match = allResults.find((p) => {
      if (itemPreference.preferred_upc && p.upc && p.upc === itemPreference.preferred_upc) return true;
      if (itemPreference.preferred_asin && p.asin && p.asin === itemPreference.preferred_asin) return true;
      if (itemPreference.display_name && p.name.toLowerCase() === itemPreference.display_name.toLowerCase()) return true;
      return false;
    });
    if (match) setRememberedKey(`${match.store}-${match.id}`);
  }, [krogerResults, amazonResults, itemPreference]); // eslint-disable-line react-hooks/exhaustive-deps
  // For batch mode: per-listItemId remembered product key
  const [batchRememberedKeys, setBatchRememberedKeys] = useState<Map<string, string | null>>(new Map());
  // For batch mode: maps product key → listItemId (to know which section owns it)
  const [batchSelectedItemMap, setBatchSelectedItemMap] = useState<Map<string, string>>(new Map());
  const [batchItems, setBatchItems] = useState<Array<{ id: string; raw_text: string }>>([]);
  const [batchResults, setBatchResults] = useState<Map<string, BatchResultItem>>(new Map());
  const [batchLoadingIds, setBatchLoadingIds] = useState<Set<string>>(new Set());
  const [cartedItemIds, setCartedItemIds] = useState<Set<string>>(new Set());

  // Fetch the list item's raw_text + preference when itemId is set

  useEffect(() => {
    if (!itemId) return;
    fetch('/api/list')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          const found = (d.items as Array<{ id: string; raw_text: string; quantity?: number; preference?: { display_name: string } | null }>)
            ?.find((i) => i.id === itemId);
          if (found) {
            setItemRawText(found.raw_text);
            setItemQuantity(found.quantity ?? 1);
            if (found.preference) setItemPreference(found.preference);
          }
        }
      })
      .catch(() => {});
  }, [itemId]); // eslint-disable-line react-hooks/exhaustive-deps
  // Batch mode: fetch list items then fire server-side parallel batch search
  useEffect(() => {
    if (mode !== 'batch' || !batchIdsParam) return;
    const ids = batchIdsParam.split(',').filter(Boolean);
    (async () => {
      try {
        const [listRes, settingsRes] = await Promise.all([
          fetch('/api/list').then((r) => r.json()),
          fetch('/api/settings').then((r) => r.json()),
        ]);
        const allItems: Array<{ id: string; raw_text: string }> = listRes.items || [];
        const selected = allItems.filter((i: { id: string }) => ids.includes(i.id));
        setBatchItems(selected);
        setBatchLoadingIds(new Set(selected.map((i) => i.id)));

        const loc = settingsRes.success ? (settingsRes.settings?.kroger_location_id || '') : '';
        const zip = settingsRes.success ? (settingsRes.settings?.default_zip_code || '80516') : '80516';

        const batchRes = await fetch('/api/search/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            queries: selected.map((i: { id: string; raw_text: string }) => ({ itemId: i.id, query: i.raw_text })),
            stores: batchStores,
            locationId: loc,
            zipCode: zip,
          }),
        });
        const batchData = await batchRes.json();
        if (batchData.success) {
          const map = new Map<string, BatchResultItem>();
          for (const r of batchData.results) {
            map.set(r.itemId, r);
          }
          setBatchResults(map);
        }
      } catch (err) {
        console.error('Batch search failed:', err);
      } finally {
        setBatchLoadingIds(new Set());
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Load settings on mount, then auto-search KS if query is provided
  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          const loc = d.settings?.kroger_location_id || '';
          const zip = d.settings?.default_zip_code || '80516';
          setLocationId(loc);
          setZipCode(zip);
          if (initialQuery && loc) {
            searchKroger(initialQuery, loc);
          }
        }
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch historical averages whenever results change (powers Stock Up badge)
  useEffect(() => {
    const allProducts = [...krogerResults, ...amazonResults];
    if (allProducts.length === 0) return;
    const names = [...new Set(allProducts.map((p) => p.name))].join(',');
    fetch(`/api/price-history/averages?names=${encodeURIComponent(names)}`)
      .then((r) => r.json())
      .then((d) => { if (d.success && d.averages) setHistoricalAverages(d.averages); })
      .catch(() => {});
  }, [krogerResults, amazonResults]); // eslint-disable-line react-hooks/exhaustive-deps

  async function searchKroger(q: string, loc?: string) {
    const useLoc = loc ?? locationId;
    if (!q.trim() || !useLoc) return;
    setLoadingKroger(true);
    setKrogerResults([]);
    try {
      const res = await fetch(`/api/kroger/products?q=${encodeURIComponent(q)}&locationId=${useLoc}&limit=20`);
      const data = await res.json();
      if (data.success) setKrogerResults(data.products);
    } catch (err) {
      console.error('KS search error:', err);
    } finally {
      setLoadingKroger(false);
    }
  }

  async function searchAmazon(q: string) {
    if (!q.trim()) return;
    setLoadingAmazon(true);
    setAmazonResults([]);
    try {
      const res = await fetch(`/api/amazon/products?q=${encodeURIComponent(q)}&zip=${zipCode}&limit=20`);
      const data = await res.json();
      if (data.success) setAmazonResults(data.products);
    } catch (err) {
      console.error('Amazon search error:', err);
    } finally {
      setLoadingAmazon(false);
    }
  }

  async function handleSearch() {
    if (!query.trim()) return;
    setKrogerResults([]);
    setAmazonResults([]);
    setAddedIds(new Set());
    if (activeStore === 'kroger') {
      await searchKroger(query);
    } else {
      await searchAmazon(query);
    }
  }

  function handleTabChange(store: 'kroger' | 'amazon') {
    setActiveStore(store);
    if (store === 'amazon' && amazonResults.length === 0 && !loadingAmazon && query.trim()) {
      searchAmazon(query);
    }
    if (store === 'kroger' && krogerResults.length === 0 && !loadingKroger && query.trim()) {
      searchKroger(query);
    }
  }

  // ─── Single-item selection handlers ──────────────────────────────────────
  function handleToggleSelect(key: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleAddSelectedToCart() {
    const allResults = [...krogerResults, ...amazonResults];
    const toAdd = allResults.filter((p) => selectedIds.has(`${p.store}-${p.id}`));
    for (const product of toAdd) {
      addItem(product, itemQuantity, itemId || undefined);
    }
    setAddedIds((prev) => {
      const next = new Set(prev);
      for (const p of toAdd) next.add(`${p.store}-${p.id}`);
      return next;
    });
    // Save preference if a radio is selected
    if (rememberedKey && itemRawText) {
      const preferred = allResults.find((p) => `${p.store}-${p.id}` === rememberedKey);
      if (preferred) {
        const { name, brand, size, store, upc, asin, price } = preferred;
        const parts: string[] = [];
        if (brand && !name.toLowerCase().startsWith(brand.toLowerCase())) parts.push(brand);
        parts.push(name);
        if (size) parts.push(size);
        fetch('/api/preferences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            generic_name: itemRawText.toLowerCase().trim(),
            display_name: name,
            preferred_upc: upc ?? null,
            preferred_asin: asin ?? null,
            preferred_store: null,
            preferred_brand: brand ?? null,
            search_override: parts.join(' ').trim(),
            last_kroger_price: store === 'kroger' ? (price ?? null) : null,
            last_amazon_price: store === 'amazon' ? (price ?? null) : null,
          }),
        }).catch((err) => console.error('Failed to save preference:', err));
      }
    }
    if (itemId) {
      fetch('/api/list', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: itemId, updates: { status: 'carted' } }),
      }).catch((err) => console.error('Failed to update item status:', err));
      setTimeout(() => router.push('/'), 600);
    }
    setSelectedIds(new Set());
  }

  // ─── Batch selection handlers ─────────────────────────────────────────────
  function handleBatchToggleSelect(key: string, listItemId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        setBatchSelectedItemMap((m) => { const n = new Map(m); n.delete(key); return n; });
      } else {
        next.add(key);
        setBatchSelectedItemMap((m) => new Map(m).set(key, listItemId));
      }
      return next;
    });
  }

  function handleBatchSelectRemember(key: string, listItemId: string) {
    setBatchRememberedKeys((prev) => new Map(prev).set(listItemId, key));
  }

  async function handleAddSelectedBatch() {
    // Group selected keys by their listItemId
    const byItem = new Map<string, ProductMatch[]>();
    const allBatchProducts = Array.from(batchResults.values()).flatMap((r) => [
      ...r.kroger,
      ...r.amazon,
    ]);
    for (const key of selectedIds) {
      const listItemId = batchSelectedItemMap.get(key);
      if (!listItemId) continue;
      const product = allBatchProducts.find((p) => `${p.store}-${p.id}` === key);
      if (!product) continue;
      const group = byItem.get(listItemId) ?? [];
      group.push(product);
      byItem.set(listItemId, group);
    }

    const affectedListItemIds: string[] = [];
    for (const [listItemId, products] of byItem.entries()) {
      const batchItem = batchItems.find((i) => i.id === listItemId);
      const batchQty = (batchItem as any)?.quantity ?? 1;
      for (const product of products) {
        addItem(product, batchQty, listItemId);
      }
      // Save preference if a radio is remembered for this item
      const preferredKey = batchRememberedKeys.get(listItemId);
      if (preferredKey) {
        const preferred = products.find((p) => `${p.store}-${p.id}` === preferredKey);
        if (preferred) {
          const rawText = batchItems.find((i) => i.id === listItemId)?.raw_text || '';
          if (rawText) {
            const { name, brand, size, store, upc, asin, price } = preferred;
            const parts: string[] = [];
            if (brand && !name.toLowerCase().startsWith(brand.toLowerCase())) parts.push(brand);
            parts.push(name);
            if (size) parts.push(size);
            fetch('/api/preferences', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                generic_name: rawText.toLowerCase().trim(),
                display_name: name,
                preferred_upc: upc ?? null,
                preferred_asin: asin ?? null,
                preferred_store: null,
                preferred_brand: brand ?? null,
                search_override: parts.join(' ').trim(),
                last_kroger_price: store === 'kroger' ? (price ?? null) : null,
                last_amazon_price: store === 'amazon' ? (price ?? null) : null,
              }),
            }).catch((err) => console.error('Failed to save preference:', err));
          }
        }
      }
      fetch('/api/list', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: listItemId, updates: { status: 'carted' } }),
      }).catch((err) => console.error('Failed to update item status:', err));
      affectedListItemIds.push(listItemId);
    }

    setAddedIds((prev) => {
      const next = new Set(prev);
      for (const key of selectedIds) next.add(key);
      return next;
    });
    setCartedItemIds((prev) => {
      const next = new Set(prev);
      for (const id of affectedListItemIds) next.add(id);
      return next;
    });
    setSelectedIds(new Set());
    setBatchSelectedItemMap(new Map());
  }

  // ─── Batch mode: early-return JSX ────────────────────────────────────────
  if (mode === 'batch') {
    const allDone = batchItems.length > 0 && batchItems.every((i) => cartedItemIds.has(i.id));
    const batchStoreView: 'kroger' | 'amazon' | 'both' =
      batchStores.includes('kroger') && batchStores.includes('amazon')
        ? 'both'
        : batchStores.includes('amazon')
          ? 'amazon'
          : 'kroger';

    return (
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 pb-10">
        <header className="pt-8 mb-8">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-on-surface-variant text-sm mb-4 bg-transparent border-none cursor-pointer hover:text-on-surface transition-colors p-0"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
            Back to Inbox
          </button>
          <h1 className="text-3xl font-bold text-on-surface" style={{ fontFamily: 'var(--font-display)' }}>
            Searching {batchItems.length} item{batchItems.length !== 1 ? 's' : ''}
          </h1>
          <p className="text-on-surface-variant mt-1 text-sm capitalize">
            {batchStores.join(' · ')}
          </p>
        </header>

        {allDone && (
          <div className="bg-white rounded-2xl border border-[#edeeef] shadow-[0_2px_15px_-3px_rgba(45,106,79,0.08)] p-6 mb-6 text-center">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: '2.5rem', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            <p className="font-semibold text-primary mt-2 mb-3">All items added to cart!</p>
            <button
              className="px-4 py-2 bg-primary text-on-primary rounded-xl font-semibold text-sm border-none cursor-pointer hover:bg-[#0d4430] transition-colors"
              onClick={() => router.push('/')}
            >
              ← Return to Inbox
            </button>
          </div>
        )}

        <BatchSearchResults
          items={batchItems}
          results={batchResults}
          loadingIds={batchLoadingIds}
          addedIds={addedIds}
          selectedIds={selectedIds}
          onToggleSelect={handleBatchToggleSelect}
          rememberedKeys={batchRememberedKeys}
          onSelectRemember={handleBatchSelectRemember}
          cartedItemIds={cartedItemIds}
          activeStore={batchStoreView}
        />

        {/* Sticky Add to Cart bar (batch mode) */}
        {selectedIds.size > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#edeeef] shadow-2xl px-5 py-3.5 flex items-center justify-between gap-4 z-50">
            <span className="text-sm text-on-surface-variant">
              {selectedIds.size} product{selectedIds.size !== 1 ? 's' : ''} selected
            </span>
            <button
              className="px-6 py-2.5 bg-primary text-on-primary rounded-xl font-bold text-sm border-none cursor-pointer hover:bg-[#0d4430] active:scale-95 transition-all flex items-center gap-2"
              onClick={handleAddSelectedBatch}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px', fontVariationSettings: "'FILL' 1" }}>shopping_cart</span>
              Add {selectedIds.size} to Cart
            </button>
          </div>
        )}
      </div>
    );
  }

  const activeResults = activeStore === 'kroger' ? krogerResults : amazonResults;
  const isLoading = activeStore === 'kroger' ? loadingKroger : loadingAmazon;

  return (
    <div className="max-w-[1280px] mx-auto px-4 md:px-6 pb-32">
      {/* Header */}
      <header className="pt-8 mb-8">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-on-surface-variant text-sm mb-4 bg-transparent border-none cursor-pointer hover:text-on-surface transition-colors p-0"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
          Back to Inbox
        </button>
        <h1 className="text-3xl font-bold text-on-surface" style={{ fontFamily: 'var(--font-display)' }}>
          {itemId ? 'Find a product' : 'Search Products'}
        </h1>
        {initialQuery && (
          <p className="text-on-surface-variant mt-1">
            Searching for: <strong className="text-on-surface">{initialQuery}</strong>
          </p>
        )}
      </header>

      {/* Search Bar */}
      <div className="flex gap-3 mb-6">
        <input
          type="text"
          placeholder="Search for products..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
          className="flex-1 px-4 py-3 text-base border border-[#edeeef] bg-surface-container-low rounded-xl outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 text-on-surface placeholder:text-outline transition-all"
          autoFocus={!initialQuery}
        />
        <button
          className="px-5 py-3 bg-primary text-on-primary rounded-xl font-semibold text-sm border-none cursor-pointer hover:bg-[#0d4430] disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all min-w-[100px]"
          onClick={handleSearch}
          disabled={isLoading || !query.trim()}
        >
          {isLoading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {/* Store Tabs */}
      <div className="flex gap-0 mb-8 border-b border-[#edeeef]">
        <button
          onClick={() => handleTabChange('kroger')}
          className={`px-5 py-2.5 border-none cursor-pointer font-semibold text-sm transition-all bg-transparent ${
            activeStore === 'kroger'
              ? 'text-kroger border-b-2 border-kroger -mb-px'
              : 'text-outline'
          }`}
        >
          King Soopers
          {krogerResults.length > 0 && (
            <span className="ml-1.5 text-[11px] opacity-60">({krogerResults.length})</span>
          )}
        </button>
        <button
          onClick={() => handleTabChange('amazon')}
          className={`px-5 py-2.5 border-none cursor-pointer font-semibold text-sm transition-all bg-transparent ${
            activeStore === 'amazon'
              ? 'text-amazon border-b-2 border-amazon -mb-px'
              : 'text-outline'
          }`}
        >
          Amazon
          <span className="font-normal text-[11px] opacity-60"> (on demand)</span>
          {amazonResults.length > 0 && (
            <span className="ml-1.5 text-[11px] opacity-60">({amazonResults.length})</span>
          )}
        </button>
      </div>

      {/* Results */}
      <SearchResults
        results={activeResults}
        addedIds={addedIds}
        selectedIds={selectedIds}
        onToggleSelect={handleToggleSelect}
        loading={isLoading}
        rememberedKey={itemId ? rememberedKey : undefined}
        onSelectRemember={itemId ? (key) => setRememberedKey(key) : undefined}
        historicalAverages={historicalAverages}
      />

      {/* Sticky Add to Cart bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#edeeef] shadow-2xl px-5 py-3.5 flex items-center justify-between gap-4 z-50">
          <span className="text-sm text-on-surface-variant">
            {selectedIds.size} product{selectedIds.size !== 1 ? 's' : ''} selected
            {rememberedKey && (
              <span className="ml-2 text-primary text-xs">· 1 remembered</span>
            )}
          </span>
          <button
            className="px-6 py-2.5 bg-primary text-on-primary rounded-xl font-bold text-sm border-none cursor-pointer hover:bg-[#0d4430] active:scale-95 transition-all flex items-center gap-2"
            onClick={handleAddSelectedToCart}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px', fontVariationSettings: "'FILL' 1" }}>shopping_cart</span>
            Add {selectedIds.size} to Cart
          </button>
        </div>
      )}
    </div>
  );
}

