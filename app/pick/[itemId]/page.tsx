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
        fetch(`/api/kroger/products?q=${encodeURIComponent(query)}&locationId=${locationId}`),
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

  async function handleConfirm(selected: ProductMatch, remember: boolean) {
    if (!item) return;

    try {
      // 1. Save preference if remember is checked
      if (remember) {
        await fetch('/api/preferences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            generic_name: item.raw_text,
            display_name: selected.name,
            preferred_upc: selected.upc,
            preferred_asin: selected.asin,
            preferred_store: null, // Keep comparing both by default
            preferred_brand: selected.brand,
            search_override: selected.name,
          }),
        });
      }

      // 2. Update list item status to mapped (or let the comparison API handle it)
      // For now, just go back to comparison
      router.push('/compare');
    } catch (err) {
      alert('Failed to save preference.');
    }
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
    <div className="container" style={{ paddingTop: 'var(--space-xl)', paddingBottom: 'var(--space-2xl)' }}>
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
