'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { ProductMatch, ListItem } from '@/types';
import { ProductPicker } from '@/components/ProductPicker';

export default function PickItemPage() {
  const [item, setItem] = useState<ListItem | null>(null);
  const [krogerProducts, setKrogerProducts] = useState<ProductMatch[]>([]);
  const [amazonProducts, setAmazonProducts] = useState<ProductMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allDone, setAllDone] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const itemId = params.itemId as string;
  const storeFilter = searchParams.get('store');

  useEffect(() => {
    fetchData();
  }, [itemId]);

  async function fetchData() {
    setLoading(true);
    setError(null);
    setKrogerProducts([]);
    setAmazonProducts([]);
    try {
      // 2. Fetch specific store location (Kroger) and Zip (Amazon)
      const [settingsRes, listRes] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/list'),
      ]);

      const [settingsData, listData] = await Promise.all([settingsRes.json(), listRes.json()]);
      const targetItem = listData.items.find((i: ListItem) => i.id === itemId);
      
      if (!targetItem) {
        setError('Item not found in current list.');
        setLoading(false);
        return;
      }
      setItem(targetItem);

      const locationId = settingsData.settings?.kroger_location_id;
      const zipCode = settingsData.settings?.default_zip_code || '80516';

      if (!locationId) {
        setError('King Soopers Location ID not set in Settings.');
        setLoading(false);
        return;
      }

      // 3. Parallel Search
      const query = targetItem.raw_text;
      const [kRes, aRes] = await Promise.all([
        fetch(`/api/kroger/products?q=${encodeURIComponent(query)}&locationId=${locationId}&limit=10`),
        fetch(`/api/amazon/products?q=${encodeURIComponent(query)}&zip=${zipCode}`),
      ]);

      const [kData, aData] = await Promise.all([kRes.json(), aRes.json()]);

      if (kData.success) setKrogerProducts(kData.products);
      if (aData.success) setAmazonProducts(aData.products);

    } catch (err) {
      setError('Failed to load item search results.');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(selected: ProductMatch, quantity: number, remember: boolean) {
    if (!item) return;
    setConfirming(true);

    try {
      // 1. Always save preference when coming from compare, or if remember is checked
      if (remember || storeFilter) {
        const prefBody: Record<string, any> = {
          generic_name: item.raw_text,
          display_name: selected.name,
          preferred_brand: selected.brand,
          search_override: selected.name,
          preferred_store: null,
        };

        // Only update the UPC/ASIN for the store of the selected product
        if (selected.store === 'kroger') {
          prefBody.preferred_upc = selected.upc;
        } else {
          prefBody.preferred_asin = selected.asin;
        }

        await fetch('/api/preferences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(prefBody),
        });
      }

      // 2. Update the list item with the selected quantity and mark as matched
      await fetch('/api/list', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          updates: { quantity, status: 'matched' },
        }),
      });

      // 3. If we came from /compare (store filter param), go back there
      if (storeFilter) {
        router.push('/compare');
        return;
      }

      // 4. Otherwise, check if any items are still unpicked
      const listRes = await fetch('/api/list');
      const listData = await listRes.json();
      const unpickedItems = listData.items.filter((i: ListItem) => i.status === 'pending');

      if (unpickedItems.length > 0) {
        const nextItem = unpickedItems.find((i: ListItem) => i.id !== itemId) || unpickedItems[0];
        router.push(`/pick/${nextItem.id}`);
      } else {
        setAllDone(true);
      }
    } catch (err) {
      setConfirming(false);
      alert('Failed to save preference or update quantity.');
    }
  }

  if (allDone) {
    return (
      <div className="container" style={{ textAlign: 'center', paddingTop: 'var(--space-4xl)' }}>
        <div className="glass-card" style={{ padding: 'var(--space-2xl)', maxWidth: 'sm', margin: '0 auto' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 600, marginBottom: 'var(--space-lg)' }}>✅ All products selected!</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-2xl)', fontSize: '1.1rem' }}>
            You've picked quantities for all items. Ready to compare prices.
          </p>
          <button 
            className="btn btn-primary btn-lg" 
            onClick={() => router.push('/compare')}
            style={{ width: '100%' }}
          >
            Go to Price Comparison →
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container" style={{ textAlign: 'center', paddingTop: 'var(--space-2xl)' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Searching for products...</h1>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="container" style={{ textAlign: 'center', paddingTop: 'var(--space-2xl)' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Error</h1>
        <p>{error}</p>
        <button className="btn btn-secondary" onClick={() => router.push('/compare')}>Back to Comparison</button>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: 'var(--space-xl)', paddingBottom: 'var(--space-2xl)', opacity: confirming ? 0.6 : 1, pointerEvents: confirming ? 'none' : 'auto' }}>
      <ProductPicker 
        itemId={itemId}
        itemName={item.raw_text}
        kroger={krogerProducts}
        amazon={amazonProducts}
        onConfirm={handleConfirm}
        onCancel={() => router.push('/compare')}
      />
    </div>
  );
}
