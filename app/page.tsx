'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AddItemBar } from '../components/AddItemBar';
import { ListItem, ListItemData } from '../components/ListItem';
import { SyncButton } from '../components/SyncButton';
import { BatchActionBar } from '../components/BatchActionBar';

export default function Home() {
  const router = useRouter();
  const [items, setItems] = useState<ListItemData[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [showPurchased, setShowPurchased] = useState(false);
  const [restoringPinned, setRestoringPinned] = useState(false);
  const [purchasedSelectedIds, setPurchasedSelectedIds] = useState<Set<string>>(new Set());
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowRef = useRef<HTMLDivElement>(null);
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());
  const initialLoadDone = useRef(false);

  // Close overflow menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setOverflowOpen(false);
      }
    }
    if (overflowOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [overflowOpen]);

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
        // On first load, pre-select all actionable items so the search count is visible
        if (!initialLoadDone.current) {
          initialLoadDone.current = true;
          const preselect = (data.items as ListItemData[])
            .filter((i) => i.status !== 'carted' && i.status !== 'purchased')
            .map((i) => i.id);
          setSelectedIds(new Set(preselect));
        }
      }
    } catch (err) {
      console.error('Failed to load list:', err);
    }
  }

  async function addItems(texts: string[]) {
    const normalized = texts.map((t) => t.trim()).filter((t) => t.length > 0);
    if (normalized.length === 0) return;

    try {
      // New items are pinned by default — they persist through Clear All
      const itemsToAdd = normalized.map((t) => ({ raw_text: t, source: 'manual' as const, persistent: true }));
      const res = await fetch('/api/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsToAdd }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchItems();
        // New items intentionally start unchecked — user opts them in explicitly
      }
    } catch (err) {
      console.error('Failed to add items:', err);
    }
  }

  function handleSkip(id: string) {
    setSkippedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
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
      setSkippedIds(new Set());
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

  function handleQuantityChange(id: string, qty: number) {
    // Optimistic
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, quantity: qty } : i));
    fetch('/api/list', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, updates: { quantity: qty } }),
    }).catch((err) => {
      console.error('Failed to update quantity:', err);
      fetchItems();
    });
  }

  function handleRename(id: string, newText: string) {
    // Optimistic — also clear normalized_text so it re-normalizes on next search
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, raw_text: newText, normalized_text: null } : i));
    fetch('/api/list', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, updates: { raw_text: newText, normalized_text: null } }),
    }).catch((err) => {
      console.error('Failed to rename item:', err);
      fetchItems();
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
    // Optimistic: immediately flip pinned-purchased items to pending
    const snapshot = items;
    setItems((prev) =>
      prev.map((i) =>
        i.persistent && i.status === 'purchased' ? { ...i, status: 'pending' } : i
      )
    );
    setRestoringPinned(true);
    try {
      const res = await fetch('/api/list/restore-pinned', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        if (data.restored > 0) {
          setSyncMessage(`📌 Restored ${data.restored} pinned item${data.restored !== 1 ? 's' : ''} to your list`);
          setTimeout(() => setSyncMessage(''), 3000);
        }
      } else {
        // API reported failure — roll back
        setItems(snapshot);
        setSyncMessage(`❌ Failed to restore: ${data.error || 'Unknown error'}`);
        setTimeout(() => setSyncMessage(''), 4000);
      }
    } catch (err) {
      console.error('Failed to restore pinned items:', err);
      setItems(snapshot);
      setSyncMessage('❌ Could not reach server — please try again.');
      setTimeout(() => setSyncMessage(''), 4000);
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

  const pinnedItems = items.filter((i) => i.persistent);
  const regularActiveItems = items.filter((i) => !i.persistent && i.status !== 'purchased');
  const todaysListItems = [...pinnedItems, ...regularActiveItems];
  const purchasedItems = items.filter((i) => !i.persistent && i.status === 'purchased');

  // Aisle grouping: only shown once at least one item has a department set
  const hasDeptData = regularActiveItems.some((i) => i.department);
  const DEPT_ORDER = ['Produce', 'Bakery', 'Deli', 'Meat', 'Seafood', 'Dairy', 'Frozen',
    'Beverages', 'Snacks', 'Pantry', 'Household', 'Personal Care', 'Pet Care', 'Other'];
  const deptGroups = hasDeptData
    ? regularActiveItems.reduce((acc, item) => {
        const key = item.department || 'Other';
        (acc[key] ??= []).push(item);
        return acc;
      }, {} as Record<string, typeof regularActiveItems>)
    : null;
  const sortedDepts = deptGroups
    ? Object.keys(deptGroups).sort((a, b) => {
        const ai = DEPT_ORDER.indexOf(a); const bi = DEPT_ORDER.indexOf(b);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      })
    : [];

  const selectableIds = todaysListItems
    .filter((i) => i.status !== 'carted' && i.status !== 'purchased' && !skippedIds.has(i.id))
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
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const storeParam = stores.join(',');
    router.push(`/search?mode=batch&ids=${encodeURIComponent(ids.join(','))}&stores=${encodeURIComponent(storeParam)}`);
  }

  function handleBatchCompare(withAmazon: boolean) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const url = `/compare?ids=${encodeURIComponent(ids.join(','))}${withAmazon ? '&amazon=true' : ''}`;
    router.push(url);
  }

  const cartedCount = items.filter((i) => i.status === 'carted').length;
  const cartedIds = items.filter((i) => i.status === 'carted').map((i) => i.id);

  async function revertCartItems() {
    if (cartedIds.length === 0) return;
    // Optimistic update
    setItems((prev) => prev.map((i) => cartedIds.includes(i.id) ? { ...i, status: 'pending' } : i));
    try {
      await fetch('/api/list/revert-cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listItemIds: cartedIds }),
      });
    } catch (err) {
      console.error('Failed to revert cart items:', err);
      fetchItems(); // re-sync on error
    }
  }

  return (
    <div className="container" style={{ paddingBottom: '120px' }}>
      {/* Header */}
      <header className="page-header" style={{ marginBottom: '1rem', paddingTop: '2.5rem' }}>
        <div>
          <h1 className="page-title">🛒 Grocery Inbox</h1>
          {skippedIds.size > 0 && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
              {skippedIds.size} skipped
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
          <SyncButton syncing={syncing} onSync={syncFromTodoist} />

          {/* ⋯ Overflow menu */}
          <div ref={overflowRef} style={{ position: 'relative' }}>
            <button
              className="btn btn-secondary btn-icon"
              onClick={() => setOverflowOpen((v) => !v)}
              aria-label="More options"
              style={{ fontSize: '1.1rem', fontWeight: 700 }}
            >
              ⋯
            </button>
            {overflowOpen && (
              <div style={{
                position: 'absolute', top: '110%', right: 0, zIndex: 200,
                background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)',
                borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                minWidth: 200, overflow: 'hidden',
              }}>
                {[
                  { label: '📌 Restore Pinned', action: () => { restorePinned(); setOverflowOpen(false); }, disabled: restoringPinned, hint: 'Move pinned items back to list' },
                  { label: '⚙️ Preferences', action: () => { router.push('/preferences'); setOverflowOpen(false); }, hint: 'Product mappings' },
                  { label: '🔧 Settings', action: () => { router.push('/settings'); setOverflowOpen(false); }, hint: 'Store & API config' },
                ].map(({ label, action, disabled, hint }) => (
                  <button
                    key={label}
                    onClick={action}
                    disabled={disabled}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '10px 16px', background: 'none', border: 'none',
                      color: disabled ? 'var(--text-muted)' : 'var(--text-primary)',
                      cursor: disabled ? 'default' : 'pointer', fontSize: '0.9rem',
                      borderBottom: '1px solid var(--border-subtle)',
                    }}
                    onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                    title={hint}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
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

      {/* Search/Compare bar — always visible when the list has items */}
      <BatchActionBar
        selectedCount={selectedIds.size}
        onSearch={handleBatchSearch}
        onCompare={handleBatchCompare}
        onClear={() => setSelectedIds(new Set())}
      />

      {/* Add Item Input */}
      <AddItemBar onAdd={addItems} />

      {/* Shopping List */}
      {todaysListItems.length > 0 && (
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
                {todaysListItems.length} item{todaysListItems.length !== 1 ? 's' : ''}
              </span>
            </h2>
            <button
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '4px 12px' }}
              onClick={clearList}
            >
              Clear All
            </button>
          </div>

          <div>
            {/* 📌 Pinned shelf */}
            {pinnedItems.length > 0 && (
              <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 700,
                            letterSpacing: '0.1em', textTransform: 'uppercase',
                            padding: '0 0 4px', opacity: 0.7 }}>
                📌 Staples
              </div>
            )}
            {pinnedItems.map((item, index) => (
              <ListItem
                key={item.id}
                item={item}
                index={index}
                onRemove={removeItem}
                selected={selectedIds.has(item.id)}
                skipped={skippedIds.has(item.id)}
                onToggle={toggleSelect}
                onTogglePersistent={togglePersistent}
                onQuantityChange={handleQuantityChange}
                onSkip={handleSkip}
                onRename={handleRename}
              />
            ))}

            {/* Subtle divider between pinned shelf and today's items */}
            {pinnedItems.length > 0 && regularActiveItems.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0 2px', margin: '4px 0 2px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: '0.67rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                  Today
                </span>
              </div>
            )}

            {/* Regular (non-pinned) active items — grouped by aisle when dept data exists */}
            {deptGroups ? (
              sortedDepts.map((dept) => (
                <div key={dept}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 0 2px', margin: '4px 0 2px',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <span style={{ fontSize: '0.67rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                      {dept}
                    </span>
                  </div>
                  {deptGroups[dept].map((item, index) => (
                    <ListItem
                      key={item.id}
                      item={item}
                      index={pinnedItems.length + index}
                      onRemove={removeItem}
                      selected={selectedIds.has(item.id)}
                      skipped={skippedIds.has(item.id)}
                      onToggle={toggleSelect}
                      onTogglePersistent={togglePersistent}
                      onQuantityChange={handleQuantityChange}
                      onSkip={handleSkip}
                      onRename={handleRename}
                    />
                  ))}
                </div>
              ))
            ) : (
              regularActiveItems.map((item, index) => (
                <ListItem
                  key={item.id}
                  item={item}
                  index={pinnedItems.length + index}
                  onRemove={removeItem}
                  selected={selectedIds.has(item.id)}
                  skipped={skippedIds.has(item.id)}
                  onToggle={toggleSelect}
                  onTogglePersistent={togglePersistent}
                  onQuantityChange={handleQuantityChange}
                  onSkip={handleSkip}
                  onRename={handleRename}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* Previously Purchased */}
      {purchasedItems.length > 0 && (
        <div className="glass-card" style={{ marginTop: 'var(--space-lg)' }}>
          {/* Header row — always visible */}
          <button
            onClick={() => setShowPurchased((v) => !v)}
            style={{
              display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center',
              background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0 8px',
              color: 'var(--text-secondary)',
            }}
          >
            <span style={{ fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              {showPurchased ? '▲' : '▼'} Previously Purchased
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {purchasedItems.length} item{purchasedItems.length !== 1 ? 's' : ''}
              {purchasedSelectedIds.size > 0 && ` · ${purchasedSelectedIds.size} selected`}
            </span>
          </button>

          {showPurchased && (
            <div>
              {/* Bulk reorder action */}
              {purchasedSelectedIds.size > 0 && (
                <div style={{ marginBottom: '8px' }}>
                  <button
                    className="btn btn-primary"
                    style={{ fontSize: '0.8rem', padding: '5px 14px' }}
                    onClick={reorderSelected}
                  >
                    ↩ Re-add {purchasedSelectedIds.size} to list
                  </button>
                </div>
              )}

              {purchasedItems.map((item) => (
                <div
                  key={item.id}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                >
                  <input
                    type="checkbox"
                    checked={purchasedSelectedIds.has(item.id)}
                    onChange={() => setPurchasedSelectedIds((prev) => {
                      const next = new Set(prev);
                      next.has(item.id) ? next.delete(item.id) : next.add(item.id);
                      return next;
                    })}
                    style={{ width: 15, height: 15, flexShrink: 0, accentColor: '#84cc16', cursor: 'pointer' }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '0.9rem', textDecoration: 'line-through', color: 'var(--text-secondary)', opacity: 0.6 }}>
                      {item.raw_text}
                    </span>
                    {item.preference && item.preference.display_name.toLowerCase() !== item.raw_text.toLowerCase() && (
                      <span style={{ marginLeft: 6, fontSize: '0.72rem', textDecoration: 'none', color: 'var(--text-muted)' }}>
                        · {item.preference.display_name}
                      </span>
                    )}
                  </div>
                  {/* Pin toggle */}
                  <button
                    onClick={() => togglePersistent(item.id)}
                    title={item.persistent ? 'Pinned — click to unpin' : 'Pin to restore later'}
                    style={{
                      background: item.persistent ? 'rgba(132,204,22,0.12)' : 'none',
                      border: item.persistent ? '1px solid rgba(132,204,22,0.3)' : '1px solid rgba(255,255,255,0.06)',
                      borderRadius: 6, color: item.persistent ? '#84cc16' : '#475569',
                      fontSize: '0.72rem', cursor: 'pointer', padding: '2px 6px', flexShrink: 0,
                    }}
                  >
                    📌
                  </button>
                  <button
                    className="btn btn-secondary btn-icon"
                    style={{ fontSize: '0.85rem', width: 26, height: 26, flexShrink: 0, opacity: 0.6 }}
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
      {todaysListItems.length === 0 && purchasedItems.length === 0 && (
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

      {/* Carted items banner — shown when DB has items stuck in 'carted' state */}
      {cartedCount > 0 && (
        <div
          className="glass-card animate-fade-in"
          style={{
            marginTop: 'var(--space-lg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '10px 16px',
            border: '1px solid rgba(34,197,94,0.25)',
            background: 'rgba(34,197,94,0.06)',
          }}
        >
          <span style={{ fontSize: '0.9rem', color: '#4ade80' }}>
            ✅ {cartedCount} item{cartedCount !== 1 ? 's' : ''} added to cart
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '4px 12px' }}
              onClick={() => router.push('/compare')}
            >
              📊 Compare
            </button>
            <button
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '4px 12px', color: 'var(--text-muted)' }}
              onClick={revertCartItems}
            >
              ↩ Not in cart
            </button>
          </div>
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

