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
  const [itemPreference, setItemPreference] = useState<{ preferred_upc?: string | null; preferred_asin?: string | null; display_name?: string } | null>(null);
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
          const found = (d.items as Array<{ id: string; raw_text: string; preference?: { display_name: string } | null }>)
            ?.find((i) => i.id === itemId);
          if (found) {
            setItemRawText(found.raw_text);
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
      const res = await fetch(`/api/amazon/products?q=${encodeURIComponent(q)}&zip=${zipCode}`);
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
      addItem(product, 1, itemId || undefined);
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
      for (const product of products) {
        addItem(product, 1, listItemId);
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
      <div className="container" style={{ paddingBottom: '40px' }}>
        <header style={{ paddingTop: '2rem', marginBottom: 'var(--space-xl)' }}>
          <button
            onClick={() => router.push('/')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '1rem',
              padding: '0.5rem 0',
              marginBottom: 'var(--space-md)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            ← Back to Inbox
          </button>
          <h1 className="page-title">
            🔍 Searching {batchItems.length} item{batchItems.length !== 1 ? 's' : ''}
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px', fontSize: '0.9rem', textTransform: 'capitalize' }}>
            {batchStores.join(' · ')}
          </p>
        </header>

        {allDone && (
          <div
            className="glass-card"
            style={{
              padding: 'var(--space-lg)',
              marginBottom: 'var(--space-lg)',
              textAlign: 'center',
              border: '1px solid rgba(34, 197, 94, 0.35)',
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🎉</div>
            <p style={{ fontWeight: 600, color: '#22c55e', marginBottom: '12px' }}>All items added to cart!</p>
            <button className="btn btn-primary" onClick={() => router.push('/')}>
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

        {/* Sticky Add to Cart bar */}
        {selectedIds.size > 0 && (
          <div
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'rgba(10, 10, 20, 0.95)',
              backdropFilter: 'blur(12px)',
              borderTop: '1px solid rgba(255,255,255,0.1)',
              padding: '14px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              zIndex: 50,
            }}
          >
            <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>
              {selectedIds.size} product{selectedIds.size !== 1 ? 's' : ''} selected
            </span>
            <button
              className="btn btn-primary"
              onClick={handleAddSelectedBatch}
              style={{ padding: '10px 24px', fontWeight: 700 }}
            >
              🛒 Add {selectedIds.size} to Cart
            </button>
          </div>
        )}
      </div>
    );
  }

  const activeResults = activeStore === 'kroger' ? krogerResults : amazonResults;
  const isLoading = activeStore === 'kroger' ? loadingKroger : loadingAmazon;

  return (
    <div className="container" style={{ paddingBottom: '120px' }}>
      {/* Header */}
      <header style={{ paddingTop: '2rem', marginBottom: 'var(--space-xl)' }}>
        <button
          onClick={() => router.push('/')}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: '1rem',
            padding: '0.5rem 0',
            marginBottom: 'var(--space-md)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          ← Back to Inbox
        </button>
        <h1 className="page-title">
          {itemId ? '🔍 Find a product' : '🔍 Search Products'}
        </h1>
        {initialQuery && (
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
            Searching for: <strong style={{ color: 'var(--text-primary)' }}>{initialQuery}</strong>
          </p>
        )}
      </header>

      {/* Search Bar */}
      <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
        <input
          type="text"
          placeholder="Search for products..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
          className="ui-input"
          style={{ flex: 1, fontSize: '1rem', padding: 'var(--space-md)' }}
          autoFocus={!initialQuery}
        />
        <button
          className="btn btn-primary btn-lg"
          onClick={handleSearch}
          disabled={isLoading || !query.trim()}
          style={{ minWidth: 110 }}
        >
          {isLoading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {/* Store Tabs */}
      <div style={{ display: 'flex', gap: '2px', marginBottom: 'var(--space-xl)', borderBottom: '1px solid var(--border-subtle)' }}>
        <button
          onClick={() => handleTabChange('kroger')}
          style={{
            padding: '10px 20px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.9rem',
            color: activeStore === 'kroger' ? '#b8d962' : 'var(--text-muted)',
            borderBottom: activeStore === 'kroger' ? '2px solid #b8d962' : '2px solid transparent',
            marginBottom: '-1px',
            transition: 'all 0.15s',
          }}
        >
          🟢 King Soopers
          {krogerResults.length > 0 && (
            <span style={{ marginLeft: 6, fontSize: '0.75rem', opacity: 0.7 }}>({krogerResults.length})</span>
          )}
        </button>
        <button
          onClick={() => handleTabChange('amazon')}
          style={{
            padding: '10px 20px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.9rem',
            color: activeStore === 'amazon' ? '#ff9900' : 'var(--text-muted)',
            borderBottom: activeStore === 'amazon' ? '2px solid #ff9900' : '2px solid transparent',
            marginBottom: '-1px',
            transition: 'all 0.15s',
          }}
        >
          🟠 Amazon{' '}
          <span style={{ fontWeight: 400, fontSize: '0.78rem', opacity: 0.7 }}>(on demand)</span>
          {amazonResults.length > 0 && (
            <span style={{ marginLeft: 6, fontSize: '0.75rem', opacity: 0.7 }}>({amazonResults.length})</span>
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
      />

      {/* Sticky Add to Cart bar */}
      {selectedIds.size > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'rgba(10, 10, 20, 0.95)',
            backdropFilter: 'blur(12px)',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            zIndex: 50,
          }}
        >
          <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>
            {selectedIds.size} product{selectedIds.size !== 1 ? 's' : ''} selected
            {rememberedKey && (
              <span style={{ marginLeft: 8, color: '#84cc16', fontSize: '0.82rem' }}>· 1 remembered</span>
            )}
          </span>
          <button
            className="btn btn-primary"
            onClick={handleAddSelectedToCart}
            style={{ padding: '10px 24px', fontWeight: 700 }}
          >
            🛒 Add {selectedIds.size} to Cart
          </button>
        </div>
      )}
    </div>
  );
}

