'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AddItemBar, AddItemBarRef } from '../components/AddItemBar';
import { ListItem, ListItemData } from '../components/ListItem';
import { SyncButton } from '../components/SyncButton';
import { BatchActionBar } from '../components/BatchActionBar';
import { DepartmentSection } from '../components/DepartmentSection';

export default function Home() {
  const router = useRouter();
  const addItemBarRef = useRef<AddItemBarRef>(null);
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
    <div className="max-w-[1280px] mx-auto px-4 md:px-6 pt-6 pb-32">

      {/* ── Page header ──────────────────────────────────────── */}
      <header className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-on-surface" style={{ fontFamily: 'var(--font-display)' }}>
            Grocery List
          </h1>
          {skippedIds.size > 0 && (
            <p className="text-sm text-outline mt-1">{skippedIds.size} skipped</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <SyncButton syncing={syncing} onSync={syncFromTodoist} />

          {/* ⋯ Overflow menu */}
          <div ref={overflowRef} className="relative">
            <button
              onClick={() => setOverflowOpen((v) => !v)}
              aria-label="More options"
              className="w-10 h-10 flex items-center justify-center rounded-xl border border-[#bfc9c1] text-outline hover:text-on-surface hover:border-outline transition-colors cursor-pointer bg-transparent text-xl font-bold"
            >
              ···
            </button>
            {overflowOpen && (
              <div className="absolute top-[110%] right-0 z-50 bg-white border border-[#edeeef] rounded-2xl shadow-xl min-w-[200px] overflow-hidden">
                {[
                  { label: 'Restore Pinned', icon: 'push_pin', action: () => { restorePinned(); setOverflowOpen(false); }, disabled: restoringPinned },
                  { label: 'Preferences', icon: 'tune', action: () => { router.push('/preferences'); setOverflowOpen(false); } },
                  { label: 'Settings', icon: 'settings', action: () => { router.push('/settings'); setOverflowOpen(false); } },
                ].map(({ label, icon, action, disabled }) => (
                  <button
                    key={label}
                    onClick={action}
                    disabled={disabled}
                    className="flex items-center gap-3 w-full text-left px-4 py-3 text-sm font-medium text-on-surface border-b border-[#edeeef] last:border-0 hover:bg-surface-container-low disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer bg-transparent"
                  >
                    <span className="material-symbols-outlined text-primary" style={{ fontSize: '16px' }}>{icon}</span>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Sync message toast */}
      {syncMessage && (
        <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium border animate-fade-in ${
          syncMessage.startsWith('Error') || syncMessage.startsWith('❌')
            ? 'bg-error-container text-error border-error/20'
            : 'bg-primary-container text-on-primary-container border-primary/20'
        }`}>
          {syncMessage}
        </div>
      )}

      {/* Batch action bar (sticky) */}
      <BatchActionBar
        selectedCount={selectedIds.size}
        onSearch={handleBatchSearch}
        onCompare={handleBatchCompare}
        onClear={() => setSelectedIds(new Set())}
      />

      {/* ── Bento grid ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">

        {/* ── Left column: list ─── */}
        <div className="lg:col-span-8 flex flex-col gap-4">

          {/* Quick Add card */}
          <div className="bg-white rounded-2xl border border-[#edeeef] shadow-[0_2px_15px_-3px_rgba(45,106,79,0.08)] p-5">
            <AddItemBar ref={addItemBarRef} onAdd={addItems} />
          </div>

          {/* Pinned staples */}
          {pinnedItems.length > 0 && (
            <DepartmentSection department="Staples" itemCount={pinnedItems.length}>
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
            </DepartmentSection>
          )}

          {/* Today's items — grouped by dept or flat */}
          {deptGroups ? (
            sortedDepts.map((dept) => (
              <DepartmentSection key={dept} department={dept} itemCount={deptGroups[dept].length}>
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
              </DepartmentSection>
            ))
          ) : regularActiveItems.length > 0 ? (
            <DepartmentSection department="Today's List" itemCount={regularActiveItems.length}>
              {regularActiveItems.map((item, index) => (
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
            </DepartmentSection>
          ) : null}

          {/* Carted banner */}
          {cartedCount > 0 && (
            <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-primary/5 border border-primary/20 animate-fade-in">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: '18px', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                <span className="text-sm font-semibold text-primary">
                  {cartedCount} item{cartedCount !== 1 ? 's' : ''} added to cart
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => router.push('/compare')}
                  className="text-xs font-semibold text-primary border border-primary/20 rounded-lg px-3 py-1.5 hover:bg-primary/5 bg-transparent cursor-pointer transition-colors"
                >
                  Compare
                </button>
                <button
                  onClick={revertCartItems}
                  className="text-xs font-medium text-outline border border-[#bfc9c1] rounded-lg px-3 py-1.5 hover:border-error/40 hover:text-error bg-transparent cursor-pointer transition-colors"
                >
                  Not in cart
                </button>
              </div>
            </div>
          )}

          {/* Empty state */}
          {todaysListItems.length === 0 && purchasedItems.length === 0 && (
            <div className="text-center py-20 animate-fade-in">
              <span className="material-symbols-outlined text-6xl text-outline/30 block mb-4" style={{ fontVariationSettings: "'FILL' 1" }}>shopping_cart</span>
              <h2 className="text-xl font-bold text-on-surface mb-2" style={{ fontFamily: 'var(--font-display)' }}>Your list is empty</h2>
              <p className="text-sm text-on-surface-variant max-w-sm mx-auto leading-relaxed">
                Add items above or sync from Todoist. Tap an item to find it at King Soopers.
              </p>
            </div>
          )}
        </div>

        {/* ── Right column: summary ─── */}
        <div className="lg:col-span-4 flex flex-col gap-4">

          {/* Summary card */}
          {todaysListItems.length > 0 && (
            <div className="bg-primary-container rounded-2xl p-5 shadow-md">
              <h3 className="text-sm font-bold uppercase tracking-wider text-on-primary-container/70 mb-4" style={{ fontFamily: 'var(--font-display)' }}>
                List Summary
              </h3>
              <div className="space-y-2 mb-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-on-primary-container/80">Total items</span>
                  <span className="text-lg font-bold text-on-primary-container" style={{ fontFamily: 'var(--font-display)' }}>{todaysListItems.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-on-primary-container/80">Selected</span>
                  <span className="text-base font-semibold text-on-primary-container">{selectedIds.size}</span>
                </div>
                {skippedIds.size > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-on-primary-container/80">Skipped</span>
                    <span className="text-base font-semibold text-on-primary-container">{skippedIds.size}</span>
                  </div>
                )}
              </div>

              {/* Select all / Compare CTA */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={toggleSelectAll}
                  disabled={selectableIds.length === 0}
                  className="w-full py-2.5 text-sm font-semibold bg-white/20 text-on-primary-container rounded-xl border border-white/30 hover:bg-white/30 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  {allSelected ? 'Deselect All' : 'Select All'}
                </button>
                <button
                  onClick={() => handleBatchCompare(true)}
                  disabled={selectedIds.size === 0}
                  className="w-full py-2.5 text-sm font-bold bg-primary text-on-primary rounded-xl shadow-[0_2px_0_0_rgba(0,0,0,0.1)] hover:bg-[#0d4430] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer border-none"
                >
                  Compare Prices →
                </button>
                <button
                  onClick={clearList}
                  className="w-full py-2 text-xs font-medium text-on-primary-container/60 hover:text-error border-none bg-transparent cursor-pointer transition-colors"
                >
                  Clear non-pinned items
                </button>
              </div>
            </div>
          )}

          {/* Purchased section */}
          {purchasedItems.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#edeeef] shadow-[0_2px_15px_-3px_rgba(45,106,79,0.08)] overflow-hidden">
              <button
                onClick={() => setShowPurchased((v) => !v)}
                className="flex w-full items-center justify-between px-4 py-3 bg-surface-container-low border-b border-[#edeeef] cursor-pointer bg-transparent border-none"
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-on-surface-variant" style={{ fontFamily: 'var(--font-display)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '16px', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  Purchased
                </span>
                <span className="flex items-center gap-2 text-xs text-outline">
                  {purchasedItems.length}
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                    {showPurchased ? 'expand_less' : 'expand_more'}
                  </span>
                </span>
              </button>

              {showPurchased && (
                <div className="p-3">
                  {purchasedSelectedIds.size > 0 && (
                    <button
                      onClick={reorderSelected}
                      className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-primary border border-primary/20 rounded-lg px-3 py-1.5 hover:bg-primary/5 bg-transparent cursor-pointer transition-colors"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>undo</span>
                      Re-add {purchasedSelectedIds.size} to list
                    </button>
                  )}
                  <div className="divide-y divide-[#edeeef]">
                    {purchasedItems.map((item) => (
                      <div key={item.id} className="flex items-center gap-2 py-2">
                        <input
                          type="checkbox"
                          checked={purchasedSelectedIds.has(item.id)}
                          onChange={() => setPurchasedSelectedIds((prev) => {
                            const next = new Set(prev);
                            next.has(item.id) ? next.delete(item.id) : next.add(item.id);
                            return next;
                          })}
                          className="w-4 h-4 flex-shrink-0 accent-primary cursor-pointer"
                        />
                        <span className="flex-1 text-sm line-through text-outline truncate">{item.raw_text}</span>
                        <button
                          onClick={() => togglePersistent(item.id)}
                          className={`flex-shrink-0 w-6 h-6 flex items-center justify-center rounded border transition-colors cursor-pointer bg-transparent ${item.persistent ? 'border-primary/30 text-primary bg-primary/5' : 'border-[#bfc9c1] text-outline'}`}
                          title={item.persistent ? 'Pinned' : 'Pin to restore'}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '12px', fontVariationSettings: item.persistent ? "'FILL' 1" : "'FILL' 0" }}>push_pin</span>
                        </button>
                        <button
                          onClick={() => removeItem(item.id)}
                          aria-label="Remove"
                          className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded text-outline hover:text-error transition-colors cursor-pointer bg-transparent border-none"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile FAB — quick add shortcut */}
      <button
        onClick={() => addItemBarRef.current?.focus()}
        aria-label="Add item"
        className="fixed bottom-24 right-6 md:hidden w-14 h-14 bg-primary text-on-primary rounded-full shadow-2xl shadow-primary/30 flex items-center justify-center active:scale-90 transition-all duration-200 z-40 border-none cursor-pointer"
      >
        <span className="material-symbols-outlined" style={{ fontSize: '26px' }}>add</span>
      </button>

      <footer className="text-center py-12 text-xs text-outline">
        King Soopers · Amazon · Powered by Kroger API &amp; SerpApi
      </footer>
    </div>
  );
}
