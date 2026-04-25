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
        aria-label={`Shopping cart — ${itemCount} item${itemCount !== 1 ? 's' : ''}`}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-2xl shadow-primary/30 hover:scale-110 hover:shadow-[0_8px_32px_rgba(15,82,56,0.4)] active:scale-90 transition-all duration-200 border-none cursor-pointer"
      >
        <span className="material-symbols-outlined" style={{ fontSize: '26px', fontVariationSettings: "'FILL' 1" }}>
          shopping_cart
        </span>
        {itemCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center rounded-full bg-error text-on-error text-[10px] font-bold border-2 border-white">
            {itemCount > 99 ? '99+' : itemCount}
          </span>
        )}
      </button>
      <CartDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}


