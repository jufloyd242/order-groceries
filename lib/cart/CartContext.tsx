'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { CartItem, StoreId, ProductMatch } from '@/types';

const STORAGE_KEY = 'sgo_cart';

interface CartContextValue {
  items: CartItem[];
  itemCount: number;
  addItem: (product: ProductMatch, quantity?: number, listItemId?: string) => void;
  removeItem: (id: string) => void;
  removeItems: (ids: string[]) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearStore: (store: StoreId) => void;
  clearCart: () => void;
  getByStore: () => { kroger: CartItem[]; amazon: CartItem[] };
  getStoreTotals: () => { kroger: number; amazon: number; total: number };
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setItems(JSON.parse(stored));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {}
  }, [items]);

  const addItem = useCallback((product: ProductMatch, quantity = 1, listItemId?: string) => {
    const id = `${product.store}-${product.id}`;
    setItems((prev) => {
      const existing = prev.find((i) => i.id === id);
      if (existing) {
        return prev.map((i) => i.id === id ? { ...i, quantity: i.quantity + quantity } : i);
      }
      const newItem: CartItem = {
        id,
        store: product.store,
        name: product.name,
        brand: product.brand,
        price: product.price ?? 0,
        quantity,
        image_url: product.image_url,
        size: product.size,
        upc: product.upc,
        asin: product.asin,
        listItemId,
        addedAt: Date.now(),
      };
      return [...prev, newItem];
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const removeItems = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    setItems((prev) => prev.filter((i) => !idSet.has(i.id)));
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity < 1) return;
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, quantity } : i)));
  }, []);

  const clearStore = useCallback((store: StoreId) => {
    setItems((prev) => prev.filter((i) => i.store !== store));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const getByStore = useCallback(() => ({
    kroger: items.filter((i) => i.store === 'kroger'),
    amazon: items.filter((i) => i.store === 'amazon'),
  }), [items]);

  const getStoreTotals = useCallback(() => {
    const kroger = items.filter((i) => i.store === 'kroger').reduce((s, i) => s + i.price * i.quantity, 0);
    const amazon = items.filter((i) => i.store === 'amazon').reduce((s, i) => s + i.price * i.quantity, 0);
    return { kroger, amazon, total: kroger + amazon };
  }, [items]);

  return (
    <CartContext.Provider value={{
      items, itemCount: items.length,
      addItem, removeItem, removeItems, updateQuantity,
      clearStore, clearCart, getByStore, getStoreTotals,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}
