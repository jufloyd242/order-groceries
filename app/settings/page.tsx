'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppSettings, Abbreviation } from '@/types';

interface KrogerStatus {
  linked: boolean;
  linked_at: string | null;
}

interface StoreLocation {
  locationId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [abbreviations, setAbbreviations] = useState<Abbreviation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [krogerStatus, setKrogerStatus] = useState<KrogerStatus | null>(null);
  const [unlinking, setUnlinking] = useState(false);

  // Location picker state
  const [locationSearchZip, setLocationSearchZip] = useState('');
  const [locationSearching, setLocationSearching] = useState(false);
  const [locationResults, setLocationResults] = useState<StoreLocation[]>([]);
  const [locationError, setLocationError] = useState('');

  // Toast messages from OAuth redirect
  const searchParams = useSearchParams();
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const router = useRouter();

  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    if (success === 'kroger_auth') {
      setStatusMessage({ type: 'success', text: '✅ King Soopers account linked successfully!' });
    } else if (error) {
      setStatusMessage({ type: 'error', text: `❌ ${decodeURIComponent(error)}` });
    }
  }, [searchParams]);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [sRes, aRes, kRes] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/abbreviations'),
        fetch('/api/kroger/auth/status'),
      ]);
      const [sData, aData, kData] = await Promise.all([sRes.json(), aRes.json(), kRes.json()]);

      if (sData.success) setSettings(sData.settings);
      if (aData.success) setAbbreviations(aData.abbreviations);
      if (!kData.error) setKrogerStatus(kData);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({ type: 'success', text: '✅ Settings saved!' });
      } else {
        setStatusMessage({ type: 'error', text: `❌ Failed to save: ${data.error}` });
      }
    } catch {
      setStatusMessage({ type: 'error', text: '❌ An unexpected error occurred.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleUnlink() {
    if (!confirm('Unlink your King Soopers account? You will need to re-authenticate to push items to cart.')) return;
    setUnlinking(true);
    try {
      await fetch('/api/kroger/auth/unlink', { method: 'DELETE' });
      setKrogerStatus({ linked: false, linked_at: null });
      setStatusMessage({ type: 'success', text: '✅ King Soopers account unlinked.' });
    } catch {
      setStatusMessage({ type: 'error', text: '❌ Failed to unlink.' });
    } finally {
      setUnlinking(false);
    }
  }

  async function handleLocationSearch() {
    const zip = locationSearchZip.trim() || settings?.default_zip_code || '';
    if (!zip) { setLocationError('Enter a zip code to search.'); return; }
    setLocationSearching(true);
    setLocationError('');
    setLocationResults([]);
    try {
      const res = await fetch(`/api/kroger/locations?zip=${encodeURIComponent(zip)}`);
      const data = await res.json();
      if (data.success && data.locations?.length) {
        setLocationResults(data.locations);
      } else if (data.success && data.locations?.length === 0) {
        setLocationError('No stores found within 10 miles of that zip code.');
      } else {
        setLocationError(data.error || 'Failed to fetch store locations.');
      }
    } catch {
      setLocationError('Failed to fetch locations.');
    } finally {
      setLocationSearching(false);
    }
  }

  function handleSelectLocation(loc: StoreLocation) {
    setSettings(prev => prev ? { ...prev, kroger_location_id: loc.locationId, kroger_store_name: loc.name } : null);
    setLocationResults([]);
    setLocationSearchZip('');
  }

  if (loading) {
    return (
      <div className="container" style={{ textAlign: 'center', paddingTop: 'var(--space-2xl)' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Loading Settings...</h1>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: 'var(--space-xl)', paddingBottom: 'var(--space-2xl)' }}>
      <header className="page-header" style={{ marginBottom: 'var(--space-xl)', paddingTop: '2.5rem' }}>
        <h1 className="page-title">⚙️ Settings</h1>
        <button className="btn btn-secondary" onClick={() => router.push('/')}>← Back</button>
      </header>

      {/* Status toast */}
      {statusMessage && (
        <div style={{
          marginBottom: 'var(--space-lg)',
          padding: '12px 16px',
          borderRadius: '8px',
          background: statusMessage.type === 'success' ? 'rgba(74, 222, 128, 0.1)' : 'rgba(248, 113, 113, 0.1)',
          border: `1px solid ${statusMessage.type === 'success' ? 'rgba(74, 222, 128, 0.3)' : 'rgba(248, 113, 113, 0.3)'}`,
          color: statusMessage.type === 'success' ? '#4ade80' : '#f87171',
          fontSize: '0.9rem',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          {statusMessage.text}
          <button
            onClick={() => setStatusMessage(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1rem' }}
          >✕</button>
        </div>
      )}

      {/* ── King Soopers Account ─────────────────────────────── */}
      <section className="glass-card" style={{ padding: 'var(--space-xl)', marginBottom: 'var(--space-xl)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-md)' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '4px' }}>🛒 King Soopers Account</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Link your account to push items directly to your King Soopers cart.
            </p>
          </div>
          {/* Linked badge */}
          <div style={{
            padding: '4px 12px',
            borderRadius: '20px',
            fontSize: '0.8rem',
            fontWeight: 600,
            background: krogerStatus?.linked ? 'rgba(74, 222, 128, 0.12)' : 'rgba(148, 163, 184, 0.1)',
            border: `1px solid ${krogerStatus?.linked ? 'rgba(74, 222, 128, 0.35)' : 'rgba(148, 163, 184, 0.2)'}`,
            color: krogerStatus?.linked ? '#4ade80' : 'var(--text-muted)',
            flexShrink: 0,
          }}>
            {krogerStatus?.linked ? '● Linked' : '○ Not Linked'}
          </div>
        </div>

        {krogerStatus?.linked ? (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Last authorized: {krogerStatus.linked_at
                ? new Date(krogerStatus.linked_at).toLocaleDateString()
                : 'unknown'}
            </span>
            <a href="/api/kroger/auth/authorize">
              <button className="btn btn-secondary" style={{ fontSize: '0.82rem', padding: '5px 14px' }}>
                🔄 Re-authorize
              </button>
            </a>
            <button
              className="btn btn-secondary"
              style={{ fontSize: '0.82rem', padding: '5px 14px', color: '#f87171', borderColor: 'rgba(248,113,113,0.3)' }}
              onClick={handleUnlink}
              disabled={unlinking}
            >
              {unlinking ? 'Unlinking…' : '🔓 Unlink Account'}
            </button>
          </div>
        ) : (
          <a href="/api/kroger/auth/authorize">
            <button className="btn btn-primary" style={{ marginTop: 'var(--space-sm)' }}>
              🔗 Link King Soopers Account
            </button>
          </a>
        )}
      </section>

      {/* ── Store Location ───────────────────────────────────── */}
      <section className="glass-card" style={{ padding: 'var(--space-xl)', marginBottom: 'var(--space-xl)' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '4px' }}>📍 Store Location</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 'var(--space-lg)' }}>
          Set your preferred King Soopers location for inventory checks and pricing.
        </p>

        {/* Current location ID */}
        <div style={{ marginBottom: 'var(--space-lg)' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Location ID
          </label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="text"
              className="ui-input"
              value={settings?.kroger_location_id || ''}
              onChange={(e) => setSettings(prev => prev ? { ...prev, kroger_location_id: e.target.value } : null)}
              placeholder="e.g. 02900520"
              style={{ maxWidth: '220px' }}
            />
            {settings?.kroger_location_id && (
              <span style={{ fontSize: '0.78rem', color: '#4ade80' }}>✓ Set</span>
            )}
          </div>
          {settings?.kroger_store_name && (
            <p style={{ marginTop: '6px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              📍 {settings.kroger_store_name}
            </p>
          )}
        </div>

        {/* Location search */}
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>Search for a store:</p>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            <input
              type="text"
              className="ui-input"
              placeholder={`Zip code (e.g. ${settings?.default_zip_code || '80516'})`}
              value={locationSearchZip}
              onChange={(e) => setLocationSearchZip(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLocationSearch()}
              style={{ maxWidth: '220px' }}
            />
            <button
              className="btn btn-secondary"
              onClick={handleLocationSearch}
              disabled={locationSearching}
              style={{ flexShrink: 0 }}
            >
              {locationSearching ? 'Searching…' : '🔍 Search'}
            </button>
          </div>

          {locationError && (
            <p style={{ fontSize: '0.82rem', color: '#f87171', marginBottom: '8px' }}>{locationError}</p>
          )}

          {locationResults.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '260px', overflowY: 'auto' }}>
              {locationResults.map((loc) => (
                <button
                  key={loc.locationId}
                  onClick={() => handleSelectLocation(loc)}
                  style={{
                    textAlign: 'left',
                    background: settings?.kroger_location_id === loc.locationId
                      ? 'rgba(132, 204, 22, 0.08)'
                      : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${settings?.kroger_location_id === loc.locationId
                      ? 'rgba(132, 204, 22, 0.35)'
                      : 'rgba(255,255,255,0.07)'}`,
                    borderRadius: '6px',
                    padding: '10px 12px',
                    cursor: 'pointer',
                    color: 'var(--text-primary)',
                    transition: 'background 0.15s',
                  }}
                >
                  <div style={{ fontWeight: 500, fontSize: '0.88rem' }}>{loc.name}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {loc.address}, {loc.city}, {loc.state} {loc.zipCode}
                    <span style={{ marginLeft: '8px', color: '#94a3b8', fontFamily: 'monospace' }}>
                      #{loc.locationId}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          className="btn btn-primary btn-lg"
          style={{ marginTop: 'var(--space-lg)' }}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save Location'}
        </button>
      </section>

      {/* ── General Settings ─────────────────────────────────── */}
      <section className="glass-card" style={{ padding: 'var(--space-xl)', marginBottom: 'var(--space-xl)' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: 'var(--space-sm)' }}>General</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-xl)', marginBottom: 'var(--space-lg)' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Default Zip Code</label>
            <input
              type="text"
              className="ui-input"
              value={settings?.default_zip_code || ''}
              onChange={(e) => setSettings(prev => prev ? { ...prev, default_zip_code: e.target.value } : null)}
            />
          </div>
        </div>

        <button
          className="btn btn-primary btn-lg"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </section>

      {/* ── Cart Cleanup ─────────────────────────────────────── */}
      <section className="glass-card" style={{ padding: 'var(--space-xl)', marginBottom: 'var(--space-xl)' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.5rem' }}>🗑️ Cart Cleanup</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 'var(--space-lg)' }}>
          When enabled, items are automatically removed from your list as soon as they are added to the shopping cart.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
          <input
            type="checkbox"
            id="auto_remove_on_cart"
            checked={settings?.auto_remove_on_cart !== 'false'}
            onChange={(e) =>
              setSettings((prev) =>
                prev ? { ...prev, auto_remove_on_cart: e.target.checked ? 'true' : 'false' } : null
              )
            }
            style={{ width: '1.1rem', height: '1.1rem', cursor: 'pointer' }}
          />
          <label htmlFor="auto_remove_on_cart" style={{ fontSize: '0.95rem', cursor: 'pointer' }}>
            Auto-remove items from list when added to cart
          </label>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Retained Items <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(never auto-removed)</span>
          </label>
          <input
            type="text"
            className="ui-input"
            value={settings?.retained_items || ''}
            onChange={(e) =>
              setSettings((prev) => (prev ? { ...prev, retained_items: e.target.value } : null))
            }
            placeholder="e.g. olive oil, coffee, oats"
            style={{ width: '100%' }}
          />
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Comma-separated list of items that always stay on your grocery list.
          </p>
        </div>

        <button
          className="btn btn-primary btn-lg"
          style={{ marginTop: 'var(--space-xl)' }}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </section>
    </div>
  );
}

