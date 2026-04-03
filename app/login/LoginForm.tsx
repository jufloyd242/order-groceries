'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogleSignIn() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
    // On success, browser is redirected — loading state stays true
  }

  return (
    <>
      <button
        onClick={handleGoogleSignIn}
        disabled={loading}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          padding: '0.85rem 1.5rem',
          background: loading ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '10px',
          color: 'var(--text-primary)',
          fontSize: '0.95rem',
          fontWeight: 500,
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => {
          if (!loading) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.1)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = loading
            ? 'rgba(255,255,255,0.04)'
            : 'rgba(255,255,255,0.06)';
        }}
      >
        {/* Google icon */}
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#EA4335" d="M24 9.5c3.15 0 5.64 1.08 7.53 2.83l5.6-5.6C33.64 3.54 29.19 1.5 24 1.5 14.97 1.5 7.3 7.1 4.1 15.02l6.53 5.07C12.32 13.77 17.68 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.02 24.5c0-1.64-.15-3.22-.42-4.75H24v9h12.38c-.53 2.87-2.16 5.3-4.6 6.93l7.18 5.58C43.04 37.41 46.02 31.43 46.02 24.5z"/>
          <path fill="#FBBC05" d="M10.63 28.93A14.5 14.5 0 0 1 9.5 24c0-1.72.3-3.38.83-4.93l-6.53-5.07A22.48 22.48 0 0 0 1.5 24c0 3.61.87 7.03 2.4 10.05l6.73-5.12z"/>
          <path fill="#34A853" d="M24 46.5c5.19 0 9.55-1.72 12.74-4.65l-7.18-5.58c-1.79 1.2-4.06 1.9-5.56 1.9-6.32 0-11.68-4.27-13.37-10.05l-6.73 5.12C7.3 40.9 14.97 46.5 24 46.5z"/>
          <path fill="none" d="M1.5 1.5h45v45h-45z"/>
        </svg>
        {loading ? 'Redirecting…' : 'Sign in with Google'}
      </button>

      {error && (
        <p style={{ marginTop: '1rem', color: '#f87171', fontSize: '0.85rem' }}>{error}</p>
      )}
    </>
  );
}
