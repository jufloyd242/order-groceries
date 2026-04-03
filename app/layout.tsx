import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from '@/lib/cart/CartContext';
import { CartButton } from '@/components/CartButton';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: "Smart Grocery Optimizer",
  description: "Compare King Soopers vs Amazon prices. Add items, compare prices, pick winners, push to cart.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="en">
      <body>
        {user && (
          <div
            style={{
              position: 'fixed',
              top: 0, left: 0, right: 0,
              zIndex: 1000,
              background: 'rgba(15, 23, 42, 0.97)',
              borderBottom: '1px solid rgba(255,255,255,0.07)',
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              padding: '6px 20px',
              gap: '12px',
              height: '40px',
            }}
          >
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {user.email}
            </span>
            <form action="/api/auth/signout" method="POST">
              <button
                type="submit"
                style={{
                  background: 'none',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '6px',
                  color: 'var(--text-secondary)',
                  fontSize: '0.75rem',
                  padding: '3px 10px',
                  cursor: 'pointer',
                }}
              >
                Sign out
              </button>
            </form>
          </div>
        )}
        <div style={{ paddingTop: user ? '40px' : 0 }}>
          <CartProvider>
            {children}
            <CartButton />
          </CartProvider>
        </div>
      </body>
    </html>
  );
}
