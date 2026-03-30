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

interface FormData {
  display_name: string;
  preferred_brand: string;
  preferred_store: string;
  search_override?: string;
}

export default function PreferencesPage() {
  const router = useRouter();
  const [preferences, setPreferences] = useState<ProductPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<FormData>({
    display_name: '',
    preferred_brand: '',
    preferred_store: 'King Soopers',
    search_override: '',
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'purchases'>('name');
  const [showForm, setShowForm] = useState(false);
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

  function handleInputChange(field: keyof FormData, value: string) {
    setFormData(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!formData.display_name.trim()) {
      setMessage('Display name is required');
      return;
    }

    try {
      const method = editingId ? 'PUT' : 'POST';
      const body = editingId 
        ? { id: editingId, ...formData }
        : { generic_name: formData.display_name.toLowerCase(), ...formData };

      const res = await fetch('/api/preferences', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.success) {
        setMessage(editingId ? '✅ Updated!' : '✅ Created!');
        setFormData({ display_name: '', preferred_brand: '', preferred_store: 'King Soopers', search_override: '' });
        setEditingId(null);
        setShowForm(false);
        await fetchPreferences();
        setTimeout(() => setMessage(''), 2000);
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (err) {
      console.error('Submit error:', err);
      setMessage('Failed to save preference');
    }
  }

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

  function handleEdit(pref: ProductPreference) {
    setFormData({
      display_name: pref.display_name,
      preferred_brand: pref.preferred_brand || '',
      preferred_store: pref.preferred_store || 'King Soopers',
      search_override: '',
    });
    setEditingId(pref.id);
    setShowForm(true);
  }

  function handleCancel() {
    setFormData({ display_name: '', preferred_brand: '', preferred_store: 'King Soopers', search_override: '' });
    setEditingId(null);
    setShowForm(false);
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
      <div className="container" style={{ paddingTop: '2rem', textAlign: 'center' }}>
        <p>Loading preferences...</p>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: '2rem', paddingBottom: '2rem' }}>
      {/* Header */}
      <header style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h1 className="page-title">⚙️ Product Preferences</h1>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? '✕ Cancel' : '+ New'}
          </button>
        </div>
        <button className="btn btn-secondary" onClick={() => router.back()} style={{ marginBottom: '1rem' }}>
          ← Back
        </button>
      </header>

      {/* Message */}
      {message && (
        <div className="glass-card" style={{ 
          padding: 'var(--space-md)', 
          marginBottom: 'var(--space-md)',
          color: message.includes('Error') ? 'var(--accent-red)' : 'var(--accent-green)',
          border: `1px solid ${message.includes('Error') ? 'var(--accent-red)' : 'var(--accent-green)'}`,
        }}>
          {message}
        </div>
      )}

      {/* Stats */}
      {preferences.length > 0 && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: 'var(--space-md)',
          marginBottom: 'var(--space-lg)',
        }}>
          <div className="glass-card" style={{ padding: 'var(--space-md)' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Total Mappings</div>
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>{preferences.length}</div>
          </div>
          <div className="glass-card" style={{ padding: 'var(--space-md)' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Avg Price (KS)</div>
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>${avgPrice.toFixed(2)}</div>
          </div>
          {mostPurchased && (
            <div className="glass-card" style={{ padding: 'var(--space-md)' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Most Purchased</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>{mostPurchased.display_name}</div>
            </div>
          )}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="glass-card" style={{ padding: 'var(--space-lg)', marginBottom: 'var(--space-lg)' }}>
          <h3 style={{ marginBottom: 'var(--space-md)', fontSize: '1.1rem' }}>
            {editingId ? 'Edit Preference' : 'Add New Preference'}
          </h3>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 'var(--space-md)' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Display Name {editingId && '(cannot change)'}
              </label>
              <input
                type="text"
                className="ui-input"
                value={formData.display_name}
                onChange={(e) => handleInputChange('display_name', e.target.value)}
                disabled={!!editingId}
                placeholder="e.g., Whole Milk"
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  Preferred Brand
                </label>
                <input
                  type="text"
                  className="ui-input"
                  value={formData.preferred_brand}
                  onChange={(e) => handleInputChange('preferred_brand', e.target.value)}
                  placeholder="e.g., Horizon"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  Preferred Store
                </label>
                <select
                  className="ui-input"
                  value={formData.preferred_store}
                  onChange={(e) => handleInputChange('preferred_store', e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option>King Soopers</option>
                  <option>Amazon</option>
                  <option>Target</option>
                  <option>Local</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                {editingId ? 'Update' : 'Create'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={handleCancel} style={{ flex: 1 }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search & Sort */}
      {preferences.length > 0 && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr auto', 
          gap: 'var(--space-md)',
          marginBottom: 'var(--space-md)',
        }}>
          <input
            type="text"
            className="ui-input"
            placeholder="Search mappings..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            className="ui-input"
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
        <div className="glass-card" style={{ overflow: 'auto' }}>
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse',
            fontSize: '0.95rem',
          }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <th style={{ textAlign: 'left', padding: 'var(--space-md)', fontWeight: 600 }}>Generic Name</th>
                <th style={{ textAlign: 'left', padding: 'var(--space-md)', fontWeight: 600 }}>Display Name</th>
                <th style={{ textAlign: 'left', padding: 'var(--space-md)', fontWeight: 600 }}>Brand</th>
                <th style={{ textAlign: 'left', padding: 'var(--space-md)', fontWeight: 600 }}>Last Price (KS)</th>
                <th style={{ textAlign: 'left', padding: 'var(--space-md)', fontWeight: 600 }}>Purchases</th>
                <th style={{ textAlign: 'left', padding: 'var(--space-md)', fontWeight: 600 }}>Store</th>
                <th style={{ textAlign: 'center', padding: 'var(--space-md)', fontWeight: 600 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((pref) => (
                <tr key={pref.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: 'var(--space-md)', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    {pref.generic_name}
                  </td>
                  <td style={{ padding: 'var(--space-md)', fontWeight: 500 }}>
                    {pref.display_name}
                  </td>
                  <td style={{ padding: 'var(--space-md)', color: 'var(--text-secondary)' }}>
                    {pref.preferred_brand || '—'}
                  </td>
                  <td style={{ padding: 'var(--space-md)' }}>
                    {pref.last_kroger_price ? `$${pref.last_kroger_price.toFixed(2)}` : '—'}
                  </td>
                  <td style={{ padding: 'var(--space-md)' }}>
                    {pref.times_purchased}
                  </td>
                  <td style={{ padding: 'var(--space-md)', color: 'var(--text-secondary)' }}>
                    {pref.preferred_store || '—'}
                  </td>
                  <td style={{ padding: 'var(--space-md)', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                      <button
                        className="btn btn-secondary"
                        onClick={() => handleEdit(pref)}
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                      >
                        ✏️
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={() => handleDelete(pref.id)}
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="glass-card" style={{ 
          padding: '3rem 2rem',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: 'var(--space-md)', opacity: 0.5 }}>
            📦
          </div>
          <h3 style={{ fontSize: '1.2rem', marginBottom: 'var(--space-sm)' }}>No preferences yet</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
            Add your first product mapping to get started
          </p>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            + Create Preference
          </button>
        </div>
      )}
    </div>
  );
}
