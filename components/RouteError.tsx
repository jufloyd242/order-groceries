'use client';

import { useEffect } from 'react';

interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
}

export function RouteError({ error, reset, title = 'Something went wrong' }: RouteErrorProps) {
  useEffect(() => {
    console.error('Route error:', error);
  }, [error]);

  return (
    <div
      className="container"
      style={{
        paddingTop: 'var(--space-2xl)',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--space-md)',
      }}
    >
      <div style={{ fontSize: '3rem' }}>⚠️</div>
      <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>{title}</h2>
      <p style={{ color: 'var(--text-muted)', maxWidth: '420px' }}>
        {error.message || 'An unexpected error occurred. Your data is safe.'}
      </p>
      <button className="btn btn-primary" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
