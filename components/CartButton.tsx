'use client';

import { useState } from 'react';
import { useCart } from '@/lib/cart/CartContext';
import { CartDrawer } from './CartDrawer';

export function CartButton() {
  const { itemCount } = useCart();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 900,
          width: '56px', height: '56px', borderRadius: '50%',
          backgroundColor: '#3b82f6', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(59,130,246,0.4)',
          fontSize: '1.4rem', transition: 'transform 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.boxShadow = '0 6px 20px rgba(59,130,246,0.5)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 16px rgba(59,130,246,0.4)';
        }}
        aria-label={`Shopping cart — ${itemCount} item${itemCount !== 1 ? 's' : ''}`}
      >
        🛒
        {itemCount > 0 && (
          <span style={{
            position: 'absolute', top: '-4px', right: '-4px',
            backgroundColor: '#ef4444', color: '#fff', borderRadius: '50%',
            width: '20px', height: '20px', fontSize: '0.7rem', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid #0f172a',
          }}>
            {itemCount > 99 ? '99+' : itemCount}
          </span>
        )}
      </button>
      <CartDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
