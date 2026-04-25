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
  const [savingLocation, setSavingLocation] = useState(false);
  const [krogerStatus, setKrogerStatus] = useState<KrogerStatus | null>(null);
  const [unlinking, setUnlinking] = useState(false);

  // Location picker state (local only — not persisted as a setting)
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
    const zip = locationSearchZip.trim();
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

  async function handleSelectLocation(loc: StoreLocation) {
    setSettings(prev => prev ? { ...prev, kroger_location_id: loc.locationId, kroger_store_name: loc.name } : null);
    setLocationResults([]);
    setLocationSearchZip('');
    setSavingLocation(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kroger_location_id: loc.locationId, kroger_store_name: loc.name }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({ type: 'success', text: `✅ Store set to ${loc.name}` });
      } else {
        setStatusMessage({ type: 'error', text: `❌ Failed to save store: ${data.error}` });
      }
    } catch {
      setStatusMessage({ type: 'error', text: '❌ Failed to save store.' });
    } finally {
      setSavingLocation(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 pt-16 text-center">
        <p className="text-on-surface-variant text-lg">Loading Settings...</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1280px] mx-auto px-4 md:px-6 pt-10 pb-16">
      <header className="flex items-start justify-between mb-8">
        <h1 className="text-3xl font-bold text-on-surface" style={{ fontFamily: 'var(--font-display)' }}>Settings</h1>
        <button
          className="px-4 py-2 bg-white text-primary border-2 border-primary/15 rounded-xl font-semibold text-sm hover:bg-primary/5 transition-colors cursor-pointer"
          onClick={() => router.push('/')}
        >← Back</button>
      </header>

      {/* Status toast */}
      {statusMessage && (
        <div className={`mb-6 px-4 py-3 rounded-xl text-sm flex justify-between items-center border ${
          statusMessage.type === 'success'
            ? 'bg-primary/5 border-primary/20 text-primary'
            : 'bg-error-container border-error/20 text-error'
        }`}>
          {statusMessage.text}
          <button
            onClick={() => setStatusMessage(null)}
            className="bg-transparent border-none text-inherit cursor-pointer text-base ml-4"
          >✕</button>
        </div>
      )}

      {/* ── King Soopers Account ─────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-[#edeeef] shadow-[0_2px_15px_-3px_rgba(45,106,79,0.08)] p-6 mb-6">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '4px' }}>🛒 King Soopers Account</h2>
            <p style={{ fontSize: '0.85rem', color: '#707973' }}>
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
            color: krogerStatus?.linked ? '#4ade80' : '#707973',
            flexShrink: 0,
          }}>
            {krogerStatus?.linked ? '● Linked' : '○ Not Linked'}
          </div>
        </div>

        {krogerStatus?.linked ? (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', color: '#707973' }}>
              Last authorized: {krogerStatus.linked_at
                ? new Date(krogerStatus.linked_at).toLocaleDateString()
                : 'unknown'}
            </span>
            <a href="/api/kroger/auth/authorize">
              <button className="px-4 py-2 bg-white text-primary border-2 border-primary/15 rounded-xl font-semibold text-sm hover:bg-primary/5 cursor-pointer" style={{ fontSize: '0.82rem', padding: '5px 14px' }}>
                🔄 Re-authorize
              </button>
            </a>
            <button
              className="px-4 py-2 bg-white text-primary border-2 border-primary/15 rounded-xl font-semibold text-sm hover:bg-primary/5 cursor-pointer"
              style={{ fontSize: '0.82rem', padding: '5px 14px', color: '#f87171', borderColor: 'rgba(248,113,113,0.3)' }}
              onClick={handleUnlink}
              disabled={unlinking}
            >
              {unlinking ? 'Unlinking…' : '🔓 Unlink Account'}
            </button>
          </div>
        ) : (
          <a href="/api/kroger/auth/authorize">
            <button className="px-4 py-2 bg-primary text-on-primary rounded-xl font-semibold text-sm border-none cursor-pointer hover:bg-[#0d4430] transition-colors" style={{ marginTop: '8px' }}>
              🔗 Link King Soopers Account
            </button>
          </a>
        )}
      </section>

      {/* ── Store Location ───────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-[#edeeef] shadow-[0_2px_15px_-3px_rgba(45,106,79,0.08)] p-6 mb-6">
        <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '4px' }}>📍 Store Location</h2>
        <p style={{ fontSize: '0.85rem', color: '#707973', marginBottom: '24px' }}>
          Set your preferred King Soopers location for inventory checks and pricing.
        </p>

        {/* Current store display (read-only) */}
        <div style={{ marginBottom: '24px', padding: '12px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          {settings?.kroger_store_name ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>📍 {settings.kroger_store_name}</span>
                <span style={{ fontSize: '0.75rem', color: '#4ade80', fontWeight: 600 }}>✓ Selected</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#707973', marginTop: '3px', fontFamily: 'monospace' }}>
                ID: {settings.kroger_location_id}
              </div>
            </>
          ) : (
            <span style={{ fontSize: '0.88rem', color: '#707973' }}>No store selected — search below to pick one.</span>
          )}
          {savingLocation && <span style={{ fontSize: '0.78rem', color: '#707973', marginLeft: '8px' }}>Saving…</span>}
        </div>

        {/* Location search */}
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ fontSize: '0.85rem', color: '#404943', marginBottom: '10px' }}>Search by zip code:</p>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            <input
              type="text"
              className="px-3 py-2 text-sm border border-[#edeeef] bg-surface-container-low rounded-xl outline-none text-on-surface placeholder:text-outline"
              placeholder="Zip code (e.g. 80516)"
              value={locationSearchZip}
              onChange={(e) => setLocationSearchZip(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLocationSearch()}
              style={{ maxWidth: '220px' }}
            />
            <button
              className="px-4 py-2 bg-white text-primary border-2 border-primary/15 rounded-xl font-semibold text-sm hover:bg-primary/5 cursor-pointer"
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
            <div className="flex flex-col gap-1.5 max-h-[260px] overflow-y-auto">
              {locationResults.map((loc) => (
                <button
                  key={loc.locationId}
                  onClick={() => handleSelectLocation(loc)}
                  disabled={savingLocation}
                  className={`text-left rounded-xl px-3 py-2.5 cursor-pointer border transition-colors ${
                    settings?.kroger_location_id === loc.locationId
                      ? 'bg-primary/5 border-primary/20'
                      : 'bg-white border-[#edeeef] hover:bg-surface-container-low'
                  } disabled:cursor-default`}
                >
                  <div className="font-medium text-sm text-on-surface">{loc.name}</div>
                  <div className="text-xs text-outline mt-0.5">
                    {loc.address}, {loc.city}, {loc.state} {loc.zipCode}
                    <span className="ml-2 font-mono text-outline">#{loc.locationId}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

      </section>

      {/* ── Preferences ──────────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-[#edeeef] shadow-[0_2px_15px_-3px_rgba(45,106,79,0.08)] p-6 mb-6">
        <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.5rem' }}>⚙️ Preferences</h2>
        <p style={{ fontSize: '0.85rem', color: '#707973', marginBottom: '24px' }}>
          When enabled, items are automatically removed from your list as soon as they are added to the shopping cart.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
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
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: '#404943' }}>
            Retained Items <span style={{ fontWeight: 400, color: '#707973' }}>(never auto-removed)</span>
          </label>
          <input
            type="text"
            className="px-3 py-2 text-sm border border-[#edeeef] bg-surface-container-low rounded-xl outline-none text-on-surface placeholder:text-outline"
            value={settings?.retained_items || ''}
            onChange={(e) =>
              setSettings((prev) => (prev ? { ...prev, retained_items: e.target.value } : null))
            }
            placeholder="e.g. olive oil, coffee, oats"
            style={{ width: '100%' }}
          />
          <p style={{ fontSize: '0.75rem', color: '#707973', marginTop: '4px' }}>
            Comma-separated list of items that always stay on your grocery list.
          </p>
        </div>

        <button
          className="px-6 py-3 bg-primary text-on-primary rounded-xl font-bold text-sm border-none cursor-pointer hover:bg-[#0d4430] transition-all"
          style={{ marginTop: '32px' }}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save Preferences'}
        </button>
      </section>
    </div>
  );
}

