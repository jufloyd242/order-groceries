'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AddItemBar } from '../components/AddItemBar';
import { ListItem, ListItemData } from '../components/ListItem';
import { SyncButton } from '../components/SyncButton';
import { BatchActionBar } from '../components/BatchActionBar';

export default function Home() {
  const router = useRouter();
  const [items, setItems] = useState<ListItemData[]>([]);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [showPurchased, setShowPurchased] = useState(false);
  const [restoringPinned, setRestoringPinned] = useState(false);
  const [purchasedSelectedIds, setPurchasedSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchItems();
  }, []);

  // Re-fetch when cart removes/clears revert list item statuses
  useEffect(() => {
    const handler = () => fetchItems();
    window.addEventListener('list-status-changed', handler);
    return () => window.removeEventListener('list-status-changed', handler);
  }, []);

  async function fetchItems() {
    try {
      const res = await fetch('/api/list');
      const data = await res.json();
      if (data.success) {
        setItems(data.items);
      }
    } catch (err) {
      console.error('Failed to load list:', err);
    }
  }

  async function addItems(texts: string[]) {
    const normalized = texts.map((t) => t.trim()).filter((t) => t.length > 0);
    if (normalized.length === 0) return;

    try {
      const itemsToAdd = normalized.map((t) => ({ raw_text: t, source: 'manual' as const }));
      const res = await fetch('/api/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsToAdd }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchItems();
      }
    } catch (err) {
      console.error('Failed to add items:', err);
    }
  }

  async function removeItem(id: string) {
    try {
      await fetch('/api/list', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      console.error('Failed to remove item:', err);
    }
  }

  async function clearList() {
    try {
      // Only delete non-persistent, non-purchased active items
      const idsToDelete = items
        .filter((i) => !i.persistent && i.status !== 'purchased')
        .map((i) => i.id);
      if (idsToDelete.length === 0) return;
      await fetch('/api/list', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: idsToDelete }),
      });
      setItems((prev) => prev.filter((i) => i.persistent || i.status === 'purchased'));
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Failed to clear list:', err);
    }
  }

  function togglePersistent(id: string) {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const newValue = !item.persistent;
    // Optimistic update
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, persistent: newValue } : i));
    fetch('/api/list', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, updates: { persistent: newValue } }),
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('Failed to toggle persistent:', err);
        // Roll back optimistic update on HTTP error
        setItems((prev) => prev.map((i) => i.id === id ? { ...i, persistent: !newValue } : i));
      }
    }).catch((err) => {
      console.error('Failed to toggle persistent (network):', err);
      setItems((prev) => prev.map((i) => i.id === id ? { ...i, persistent: !newValue } : i));
    });
  }

  async function reorderItem(id: string) {
    try {
      await fetch('/api/list', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, updates: { status: 'pending' } }),
      });
      setItems((prev) => prev.map((i) => i.id === id ? { ...i, status: 'pending' } : i));
      setPurchasedSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    } catch (err) {
      console.error('Failed to reorder item:', err);
    }
  }

  async function reorderSelected() {
    const ids = Array.from(purchasedSelectedIds);
    if (ids.length === 0) return;
    await Promise.all(ids.map((id) =>
      fetch('/api/list', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, updates: { status: 'pending' } }),
      }).catch((err) => console.error('Failed to reorder item:', err))
    ));
    setItems((prev) => prev.map((i) => ids.includes(i.id) ? { ...i, status: 'pending' } : i));
    setPurchasedSelectedIds(new Set());
  }

  async function restorePinned() {
    setRestoringPinned(true);
    try {
      const res = await fetch('/api/list/restore-pinned', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        await fetchItems();
        if (data.restored > 0) {
          setSyncMessage(`📌 Restored ${data.restored} pinned item${data.restored !== 1 ? 's' : ''} to your list`);
          setTimeout(() => setSyncMessage(''), 3000);
        }
      }
    } catch (err) {
      console.error('Failed to restore pinned items:', err);
    } finally {
      setRestoringPinned(false);
    }
  }

  async function syncFromTodoist() {
    setSyncing(true);
    setSyncMessage('');
    try {
      const res = await fetch('/api/todoist/sync');
      const data = await res.json();

      if (!data.success) {
        setSyncMessage(`Error: ${data.error}`);
        return;
      }

      if (data.items.length === 0) {
        setSyncMessage('No items found in Todoist "groceries" project.');
        return;
      }

      const addRes = await fetch('/api/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: data.items }),
      });
      const addData = await addRes.json();

      if (addData.success) {
        await fetchItems();
        setSyncMessage(
          `Synced ${addData.added} item${addData.added !== 1 ? 's' : ''} from Todoist` +
            (addData.skipped > 0 ? ` (${addData.skipped} already in list)` : '')
        );
      }
    } catch (err) {
      console.error('Todoist sync failed:', err);
      setSyncMessage('Sync failed. Check your Todoist API token.');
    } finally {
      setSyncing(false);
    }
  }

  function handleSearch(itemId: string, query: string) {
    router.push(`/search?itemId=${itemId}&q=${encodeURIComponent(query)}`);
  }

  const activeItems = items.filter((i) => i.status !== 'purchased');
  const purchasedItems = items.filter((i) => i.status === 'purchased');

  const selectableIds = activeItems
    .filter((i) => i.status !== 'carted')
    .map((i) => i.id);

  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableIds));
    }
  }

  function handleBatchSearch(stores: ('kroger' | 'amazon')[]) {
    const selected = activeItems.filter((i) => selectedIds.has(i.id));
    if (selected.length === 0) return;
    const ids = selected.map((i) => i.id).join(',');
    const storeParam = stores.join(',');
    router.push(`/search?mode=batch&ids=${encodeURIComponent(ids)}&stores=${encodeURIComponent(storeParam)}`);
  }

  const pendingCount = activeItems.filter((i) => i.status === 'pending' || i.status === 'matched').length;
  const cartedCount = activeItems.filter((i) => i.status === 'carted').length;

  return (
    <div className="container" style={{ paddingBottom: '120px' }}>
      {/* Header */}
      <header className="page-header" style={{ marginBottom: '1rem', paddingTop: '2.5rem' }}>
        <div>
          <h1 className="page-title">🛒 Grocery Inbox</h1>
          {items.length > 0 && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
              {pendingCount > 0 ? `${pendingCount} need finding` : ''}
              {pendingCount > 0 && cartedCount > 0 ? ' · ' : ''}
              {cartedCount > 0 ? `${cartedCount} in cart` : ''}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
          <SyncButton syncing={syncing} onSync={syncFromTodoist} />
          <button
            className="btn btn-secondary"
            onClick={restorePinned}
            disabled={restoringPinned}
            title="Move all pinned purchased items back to active list"
          >
            {restoringPinned ? '⏳' : '📌'} Restore Pinned
          </button>
          <button className="btn btn-secondary btn-icon" onClick={() => setBulkMode(!bulkMode)}>
            📋
          </button>
          <button className="btn btn-secondary btn-icon" onClick={() => router.push('/preferences')}>
            ⚙️
          </button>
          <button className="btn btn-secondary btn-icon" onClick={() => router.push('/settings')}>
            🔧
          </button>
        </div>
      </header>

      {/* Sync message */}
      {syncMessage && (
        <div
          className="glass-card animate-fade-in"
          style={{
            padding: 'var(--space-sm) var(--space-md)',
            marginBottom: 'var(--space-md)',
            fontSize: '0.9rem',
            border: `1px solid ${syncMessage.startsWith('Error') ? 'var(--accent-red)' : 'var(--accent-green)'}`,
            color: syncMessage.startsWith('Error') ? 'var(--accent-red)' : 'var(--accent-green)',
            backgroundColor: 'rgba(0,0,0,0.4)',
          }}
        >
          {syncMessage}
        </div>
      )}

      {/* Selection Mode bar — shown above the list when items are checked */}
      <BatchActionBar
        selectedCount={selectedIds.size}
        onSearch={handleBatchSearch}
      />

      {/* Add Item Input */}
      <AddItemBar onAdd={addItems} bulkMode={bulkMode} setBulkMode={setBulkMode} />

      {/* Shopping List */}
      {activeItems.length > 0 && (
        <div className="glass-card" style={{ marginTop: 'var(--space-lg)' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--space-md)',
            }}
          >
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  disabled={selectableIds.length === 0}
                  style={{ width: 16, height: 16, accentColor: '#84cc16', cursor: 'pointer' }}
                  aria-label="Select all"
                />
              TODAY&apos;S LIST
              <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                {activeItems.length} item{activeItems.length !== 1 ? 's' : ''}
              </span>
            </h2>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {purchasedItems.length > 0 && (
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '4px 12px', color: showPurchased ? '#84cc16' : undefined }}
                  onClick={() => setShowPurchased((v) => !v)}
                >
                  {showPurchased ? '▲' : '▼'} Purchased ({purchasedItems.length})
                </button>
              )}
              <button
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '4px 12px' }}
                onClick={clearList}
              >
                Clear All
              </button>
            </div>
          </div>

          <div>
            {activeItems.map((item, index) => (
              <ListItem
                key={item.id}
                item={item}
                index={index}
                onRemove={removeItem}
                selected={selectedIds.has(item.id)}
                onToggle={toggleSelect}
                onTogglePersistent={togglePersistent}
              />
            ))}
          </div>
        </div>
      )}

      {/* Previously Purchased (standalone — visible even when active list is empty) */}
      {purchasedItems.length > 0 && (
        <div className="glass-card" style={{ marginTop: 'var(--space-lg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>
                PREVIOUSLY PURCHASED
              </h2>
              <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.9rem' }}>
                {purchasedItems.length} item{purchasedItems.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {purchasedSelectedIds.size > 0 && (
                <button
                  className="btn btn-primary"
                  style={{ fontSize: '0.78rem', padding: '4px 14px' }}
                  onClick={reorderSelected}
                >
                  ↩ Reorder {purchasedSelectedIds.size} selected
                </button>
              )}
              <button
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '4px 12px', color: showPurchased ? '#84cc16' : undefined }}
                onClick={() => setShowPurchased((v) => !v)}
              >
                {showPurchased ? '▲ Hide' : '▼ Show'}
              </button>
            </div>
          </div>

          {showPurchased && purchasedItems.length > 0 && (
            <div>
              {purchasedItems.map((item) => (
                <div
                  key={item.id}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                >
                  <input
                    type="checkbox"
                    checked={purchasedSelectedIds.has(item.id)}
                    onChange={() => setPurchasedSelectedIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(item.id)) next.delete(item.id);
                      else next.add(item.id);
                      return next;
                    })}
                    style={{ width: 16, height: 16, flexShrink: 0, accentColor: '#84cc16', cursor: 'pointer' }}
                  />
                  <div style={{ flex: 1, fontSize: '0.9rem', textDecoration: 'line-through', color: 'var(--text-secondary)', opacity: 0.65 }}>
                    {item.raw_text}
                    {item.preference && (
                      <span style={{ marginLeft: 8, fontSize: '0.72rem', textDecoration: 'none', color: '#4ade80' }}>
                        · {item.preference.display_name}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => togglePersistent(item.id)}
                    title={item.persistent ? 'Pinned — click to unpin' : 'Pin to restore with "Restore Pinned"'}
                    style={{
                      background: item.persistent ? 'rgba(132, 204, 22, 0.12)' : 'none',
                      border: item.persistent ? '1px solid rgba(132, 204, 22, 0.35)' : '1px solid transparent',
                      borderRadius: '6px',
                      color: item.persistent ? '#84cc16' : '#475569',
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      padding: '3px 6px',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                    }}
                  >
                    {item.persistent ? '📌 Pinned' : '📌'}
                  </button>
                  <button
                    className="btn btn-secondary btn-icon"
                    style={{ fontSize: '0.9rem', width: 28, height: 28, flexShrink: 0 }}
                    onClick={() => removeItem(item.id)}
                    aria-label="Remove"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {activeItems.length === 0 && purchasedItems.length === 0 && (
        <div
          className="glass-card animate-fade-in"
          style={{
            marginTop: 'var(--space-2xl)',
            textAlign: 'center',
            padding: '4rem 2rem',
          }}
        >
          <div style={{ fontSize: '4rem', marginBottom: 'var(--space-md)', opacity: 0.8 }}>🛒</div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 600, marginBottom: 'var(--space-sm)' }}>
            Your inbox is empty
          </h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 400, margin: '0 auto', fontSize: '1.05rem', lineHeight: 1.5 }}>
            Add items above or sync from Todoist. Tap an item to find it at King Soopers.
          </p>
        </div>
      )}

      {/* Compare prices hint */}
      {cartedCount > 0 && (
        <div style={{ marginTop: 'var(--space-lg)', textAlign: 'center' }}>
          <button
            className="btn btn-secondary"
            onClick={() => router.push('/compare')}
            style={{ fontSize: '0.9rem' }}
          >
            📊 Compare prices across stores
          </button>
        </div>
      )}

      {/* Footer */}
      <footer
        style={{
          textAlign: 'center',
          padding: 'var(--space-xl) 0',
          color: 'var(--text-muted)',
          fontSize: '0.8rem',
        }}
      >
        King Soopers · Amazon · Powered by Kroger API &amp; SerpApi
      </footer>
    </div>
  );
}

