import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import LoginForm from './LoginForm';

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Already logged in — go home
  if (user) redirect('/');

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '420px',
          textAlign: 'center',
          padding: '3rem 2.5rem',
        }}
      >
        <div style={{ fontSize: '3.5rem', marginBottom: '1.25rem' }}>🛒</div>
        <h1
          style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            marginBottom: '0.5rem',
            color: 'var(--text-primary)',
          }}
        >
          Smart Grocery Optimizer
        </h1>
        <p
          style={{
            color: 'var(--text-secondary)',
            marginBottom: '2rem',
            fontSize: '0.95rem',
            lineHeight: 1.5,
          }}
        >
          Compare King Soopers vs Amazon prices and push directly to your cart.
        </p>
        <LoginForm />
      </div>
    </div>
  );
}
