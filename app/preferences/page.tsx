'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface ProductPreference {
  id: string;
  generic_name: string;
  display_name: string;
  preferred_brand?: string;
  preferred_store?: string;
  last_kroger_price?: number;
  times_purchased: number;
}

export default function PreferencesPage() {
  const router = useRouter();
  const [preferences, setPreferences] = useState<ProductPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'purchases'>('name');
  const [message, setMessage] = useState('');

  // Fetch preferences on mount
  useEffect(() => {
    fetchPreferences();
  }, []);

  async function fetchPreferences() {
    try {
      setLoading(true);
      const res = await fetch('/api/preferences');
      const data = await res.json();
      if (data.success) {
        setPreferences(data.preferences || []);
      }
    } catch (err) {
      console.error('Failed to fetch preferences:', err);
      setMessage('Error loading preferences');
    } finally {
      setLoading(false);
    }
  }

  function handleDelete(id: string): void;
  async function handleDelete(id: string) {
    if (!confirm('Delete this preference?')) return;

    try {
      const res = await fetch('/api/preferences', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      const data = await res.json();
      if (data.success) {
        setMessage('✅ Deleted!');
        await fetchPreferences();
        setTimeout(() => setMessage(''), 2000);
      }
    } catch (err) {
      console.error('Delete error:', err);
      setMessage('Failed to delete preference');
    }
  }

  // Filter and sort
  const filtered = preferences
    .filter(p => 
      p.generic_name.includes(searchTerm.toLowerCase()) ||
      p.display_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'name') return a.display_name.localeCompare(b.display_name);
    if (sortBy === 'price') return (b.last_kroger_price || 0) - (a.last_kroger_price || 0);
    return b.times_purchased - a.times_purchased;
  });

  // Stats
  const avgPrice = preferences.length > 0
    ? preferences.reduce((sum, p) => sum + (p.last_kroger_price || 0), 0) / preferences.length
    : 0;
  const mostPurchased = preferences.reduce((max, p) => 
    p.times_purchased > max.times_purchased ? p : max, preferences[0]);

  if (loading) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 pt-16 text-center">
        <p className="text-on-surface-variant">Loading preferences...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 max-w-[1280px] mx-auto w-full px-4 md:px-6 pt-10 pb-10">
      {/* Header */}
      <header className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold text-on-surface" style={{ fontFamily: 'var(--font-display)' }}>Product Preferences</h1>
        </div>
        <button
          className="px-4 py-2 bg-white text-primary border-2 border-primary/15 rounded-xl font-semibold text-sm hover:bg-primary/5 transition-colors cursor-pointer"
          onClick={() => router.back()}
        >
          ← Back
        </button>
      </header>

      {/* Message */}
      {message && (
        <div className="px-4 py-3 rounded-xl border mb-4 text-sm" style={{
          color: message.includes('Error') ? '#ba1a1a' : '#0f5238',
          border: `1px solid ${message.includes('Error') ? '#ba1a1a' : '#0f5238'}`,
        }}>
          {message}
        </div>
      )}

      {/* Stats */}
      {preferences.length > 0 && (
        <div style={{ 
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}>
          <div className="bg-white rounded-2xl border border-[#edeeef] shadow-[0_2px_15px_-3px_rgba(45,106,79,0.08)] p-4">
            <div style={{ fontSize: '0.85rem', color: '#707973' }}>Total Mappings</div>
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>{preferences.length}</div>
          </div>
          <div className="bg-white rounded-2xl border border-[#edeeef] shadow-[0_2px_15px_-3px_rgba(45,106,79,0.08)] p-4">
            <div style={{ fontSize: '0.85rem', color: '#707973' }}>Avg Price (KS)</div>
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>${avgPrice.toFixed(2)}</div>
          </div>
          {mostPurchased && (
            <div className="bg-white rounded-2xl border border-[#edeeef] shadow-[0_2px_15px_-3px_rgba(45,106,79,0.08)] p-4">
              <div style={{ fontSize: '0.85rem', color: '#707973' }}>Most Purchased</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>{mostPurchased.display_name}</div>
            </div>
          )}
        </div>
      )}

      {/* Search & Sort */}
      {preferences.length > 0 && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr auto', 
          gap: '16px',
          marginBottom: '16px',
        }}>
          <input
            type="text"
            className="px-4 py-2.5 text-sm border border-[#edeeef] bg-surface-container-low rounded-xl outline-none focus:border-primary/40 text-on-surface placeholder:text-outline"
            placeholder="Search mappings..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            className="px-4 py-2.5 text-sm border border-[#edeeef] bg-surface-container-low rounded-xl outline-none focus:border-primary/40 text-on-surface placeholder:text-outline"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'price' | 'purchases')}
          >
            <option value="name">Sort: A-Z</option>
            <option value="price">Sort: Price</option>
            <option value="purchases">Sort: Purchases</option>
          </select>
        </div>
      )}

      {/* Table */}
      {sorted.length > 0 ? (
        <div className="bg-white rounded-2xl border border-[#edeeef] shadow-[0_2px_15px_-3px_rgba(45,106,79,0.08)] overflow-auto">
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse',
            fontSize: '0.95rem',
          }}>
            <thead>
              <tr className="border-b border-[#edeeef]">
                <th style={{ textAlign: 'left', padding: '16px', fontWeight: 600 }}>Generic Name</th>
                <th style={{ textAlign: 'left', padding: '16px', fontWeight: 600 }}>Display Name</th>
                <th style={{ textAlign: 'left', padding: '16px', fontWeight: 600 }}>Brand</th>
                <th style={{ textAlign: 'left', padding: '16px', fontWeight: 600 }}>Last Price (KS)</th>
                <th style={{ textAlign: 'left', padding: '16px', fontWeight: 600 }}>Purchases</th>
                <th style={{ textAlign: 'left', padding: '16px', fontWeight: 600 }}>Store</th>
                <th style={{ textAlign: 'center', padding: '16px', fontWeight: 600 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((pref) => (
                <tr key={pref.id} className="border-b border-[#edeeef]">
                  <td style={{ padding: '16px', color: '#707973', fontSize: '0.9rem' }}>
                    {pref.generic_name}
                  </td>
                  <td style={{ padding: '16px', fontWeight: 500 }}>
                    {pref.display_name}
                  </td>
                  <td style={{ padding: '16px', color: '#404943' }}>
                    {pref.preferred_brand || '—'}
                  </td>
                  <td style={{ padding: '16px' }}>
                    {pref.last_kroger_price ? `$${pref.last_kroger_price.toFixed(2)}` : '—'}
                  </td>
                  <td style={{ padding: '16px' }}>
                    {pref.times_purchased}
                  </td>
                  <td style={{ padding: '16px', color: '#404943' }}>
                    {pref.preferred_store || '—'}
                  </td>
                  <td style={{ padding: '16px', textAlign: 'center' }}>
                    <button
                      className="px-3 py-1.5 text-xs font-semibold bg-white text-error border-2 border-error/15 rounded-lg hover:bg-error/5 cursor-pointer"
                      onClick={() => handleDelete(pref.id)}
                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#edeeef] shadow-[0_2px_15px_-3px_rgba(45,106,79,0.08)] py-12 px-8 text-center">
          <div style={{ fontSize: '3rem', marginBottom: '16px', opacity: 0.5 }}>
            📦
          </div>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>No learned preferences yet</h3>
          <p style={{ color: '#404943', marginBottom: '16px' }}>
            Preferences are saved automatically when you check “💾 Remember” on a search result and add it to your cart.
          </p>
        </div>
      )}
    </div>
  );
}
