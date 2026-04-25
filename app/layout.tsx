import type { Metadata } from "next";
import Link from "next/link";
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
      <head>
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
      </head>
      <body className="bg-surface text-on-surface">
        {/* ── Top Navigation ── */}
        <nav className="sticky top-0 z-50 flex items-center justify-between px-6 md:px-8 h-16 w-full bg-white/90 backdrop-blur-md border-b border-[#edeeef] shadow-[0_2px_15px_-3px_rgba(45,106,79,0.08)]">
          {/* Brand + Nav links */}
          <div className="flex items-center gap-8">
            <Link
              href="/"
              className="text-lg font-black tracking-tight text-primary"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Smart Grocery
            </Link>
            <div className="hidden md:flex items-center gap-6 text-sm font-medium" style={{ fontFamily: 'var(--font-display)' }}>
              <Link href="/" className="text-on-surface-variant hover:text-primary transition-colors duration-150">
                My List
              </Link>
              <Link href="/compare" className="text-on-surface-variant hover:text-primary transition-colors duration-150">
                Compare
              </Link>
              <Link href="/settings" className="text-on-surface-variant hover:text-primary transition-colors duration-150">
                Settings
              </Link>
            </div>
          </div>

          {/* Right: user + sign out */}
          {user ? (
            <div className="flex items-center gap-3">
              <span className="hidden sm:block text-sm text-on-surface-variant truncate max-w-[180px]">
                {user.email}
              </span>
              <form action="/api/auth/signout" method="POST">
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs font-semibold border border-[#bfc9c1] rounded-lg text-on-surface-variant hover:border-primary hover:text-primary transition-colors duration-150 cursor-pointer bg-transparent"
                >
                  Sign out
                </button>
              </form>
            </div>
          ) : (
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-semibold bg-primary text-on-primary rounded-lg shadow-[0_2px_0_0_rgba(0,0,0,0.1)] hover:bg-[#0d4430] active:scale-[0.97] transition-all duration-150"
            >
              Sign in
            </Link>
          )}
        </nav>

        {/* ── Page content ── */}
        <CartProvider>
          {children}
          <CartButton />
        </CartProvider>
      </body>
    </html>
  );
}

