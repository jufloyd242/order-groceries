'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';
import { AddItemBar } from '../components/AddItemBar';
import { ListItem } from '../components/ListItem';
import { SyncButton } from '../components/SyncButton';

// Share common types
export interface ListItemData {
  id: string;
  raw_text: string;
  source: 'manual' | 'todoist';
  status: string;
  preference_match?: string | null;
}

interface PreferenceData {
  generic_name: string;
  display_name: string;
}

export default function Home() {
  const [items, setItems] = useState<ListItemData[]>([]);
  const [preferences, setPreferences] = useState<PreferenceData[]>([]);
  const [bulkMode, setBulkMode] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  // Load list items and preferences on mount
  useEffect(() => {
    fetchItems();
    fetchPreferences();
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

  async function fetchPreferences() {
    try {
      const res = await fetch('/api/preferences');
      const data = await res.json();
      if (data.success) {
        setPreferences(
          data.preferences.map((p: PreferenceData) => ({
            generic_name: p.generic_name,
            display_name: p.display_name,
          }))
        );
      }
    } catch (err) {
      console.error('Failed to load preferences:', err);
    }
  }

  function findPreferenceMatch(rawText: string): string | null {
    const lower = rawText.toLowerCase().trim();
    const match = preferences.find(
      (p) =>
        p.generic_name === lower || lower.includes(p.generic_name)
    );
    return match ? match.display_name : null;
  }

  async function addItems(texts: string[]) {
    const itemsToAdd = texts
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
      .map((t) => ({ raw_text: t, source: 'manual' }));

    if (itemsToAdd.length === 0) return;

    try {
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
      await fetch('/api/list', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clear: true }),
      });
      setItems([]);
    } catch (err) {
      console.error('Failed to clear list:', err);
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

      // Add synced items to the list
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
            (addData.skipped > 0
              ? ` (${addData.skipped} already in list)`
              : '')
        );
      }
    } catch (err) {
      console.error('Todoist sync failed:', err);
      setSyncMessage('Sync failed. Check your Todoist API token.');
    } finally {
      setSyncing(false);
    }
  }

  const matchedCount = items.filter((i) => findPreferenceMatch(i.raw_text)).length;
  const unmatchedCount = items.length - matchedCount;

  return (
    <div className="container" style={{ paddingBottom: '120px' }}>
      {/* Header */}
      <header className="page-header" style={{ marginBottom: '1rem', paddingTop: '2.5rem' }}>
        <h1 className="page-title">🛒 Smart Grocery Optimizer</h1>
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <SyncButton syncing={syncing} onSync={syncFromTodoist} />
          <button className="btn btn-secondary btn-icon" onClick={() => setBulkMode(!bulkMode)}>
            📋
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
            backgroundColor: 'rgba(0,0,0,0.4)'
          }}
        >
          {syncMessage}
        </div>
      )}

      {/* Add Item Input */}
      <AddItemBar onAdd={addItems} bulkMode={bulkMode} setBulkMode={setBulkMode} />

      {/* Shopping List */}
      {items.length > 0 && (
        <div className="glass-card" style={{ marginTop: 'var(--space-lg)' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 'var(--space-md)',
          }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              TODAY&apos;S LIST
              <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 'var(--space-sm)' }}>
                {items.length} item{items.length !== 1 ? 's' : ''}
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

          {/* Mapping status summary */}
          <div style={{
            display: 'flex',
            gap: 'var(--space-md)',
            marginBottom: 'var(--space-md)',
            paddingBottom: 'var(--space-md)',
            borderBottom: '1px solid var(--border-subtle)',
            fontSize: '0.85rem',
          }}>
            {matchedCount > 0 && (
              <span className="badge badge-green">✅ {matchedCount} mapped</span>
            )}
            {unmatchedCount > 0 && (
              <span className="badge badge-amber">⚠️ {unmatchedCount} new</span>
            )}
          </div>

          {/* Item list */}
          <div>
            {items.map((item, index) => {
              const match = findPreferenceMatch(item.raw_text);
              return (
                <ListItem 
                  key={item.id} 
                  item={item} 
                  index={index} 
                  matchName={match} 
                  onRemove={removeItem} 
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && (
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
            Your list is empty
          </h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 400, margin: '0 auto', fontSize: '1.05rem', lineHeight: 1.5 }}>
            Add items above or sync from Todoist. Type naturally — &quot;milk&quot;,
            &quot;tp&quot;, &quot;chx breast 2lbs&quot;. The system learns your preferences over time.
          </p>
        </div>
      )}

      {/* Compare Prices CTA */}
      {items.length > 0 && (
        <div style={{ 
          position: 'fixed', 
          bottom: 0, 
          left: 0, 
          right: 0, 
          padding: 'var(--space-md)', 
          background: 'linear-gradient(to top, rgba(2,6,23,0.95) 40%, transparent)',
          textAlign: 'center',
          pointerEvents: 'none',
          display: 'flex',
          justifyContent: 'center',
          zIndex: 10
        }}>
          <a href="/compare" className="btn btn-primary btn-lg shadow-lg" style={{ width: '100%', maxWidth: '400px', pointerEvents: 'auto', padding: '16px', fontSize: '1.1rem' }}>
            🔍 Compare Prices ({items.length} item{items.length !== 1 ? 's' : ''})
          </a>
        </div>
      )}

      {/* Footer */}
      <footer style={{
        textAlign: 'center',
        padding: 'var(--space-xl) 0',
        color: 'var(--text-muted)',
        fontSize: '0.8rem',
      }}>
        King Soopers (80516) · Amazon · Powered by Kroger API &amp; SerpApi
      </footer>
    </div>
  );
}
