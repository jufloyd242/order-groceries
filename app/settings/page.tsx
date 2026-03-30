'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppSettings, Abbreviation } from '@/types';

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [abbreviations, setAbbreviations] = useState<Abbreviation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [sRes, aRes] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/abbreviations'),
      ]);
      const [sData, aData] = await Promise.all([sRes.json(), aRes.json()]);

      if (sData.success) setSettings(sData.settings);
      if (aData.success) setAbbreviations(aData.abbreviations);
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
        alert('Settings saved!');
      } else {
        alert('Failed to save settings: ' + data.error);
      }
    } catch (err) {
      alert('An unexpected error occurred.');
    } finally {
      setSaving(false);
    }
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

      {/* Store Configuration */}
      <section className="glass-card" style={{ padding: 'var(--space-xl)', marginBottom: 'var(--space-xl)' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: 'var(--space-lg)' }}>Store Configuration</h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-xl)' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Default Zip Code</label>
            <input 
              type="text" 
              className="ui-input" 
              value={settings?.default_zip_code || ''} 
              onChange={(e) => setSettings(prev => prev ? { ...prev, default_zip_code: e.target.value } : null)}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Kroger Location ID</label>
            <input 
              type="text" 
              className="ui-input" 
              value={settings?.kroger_location_id || ''} 
              onChange={(e) => setSettings(prev => prev ? { ...prev, kroger_location_id: e.target.value } : null)}
              placeholder="e.g. 02900520"
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Used for King Soopers inventory & localized pricing.
            </p>
          </div>
        </div>

        <button 
          className="btn btn-primary btn-lg" 
          style={{ marginTop: 'var(--space-xl)' }}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </section>

      {/* Preference Manager link (stretch) */}
      <section className="glass-card" style={{ padding: 'var(--space-md)', opacity: 0.6 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Advanced Preference Manager</h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Coming in Phase 4: Full editor for saved mappings and abbreviation dictionary.</p>
      </section>
    </div>
  );
}
