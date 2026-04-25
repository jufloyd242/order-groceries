'use client';

import { useCart } from '@/lib/cart/CartContext';
import { submitCart } from '@/lib/cart/services/registry';
import { CartItem } from '@/types';
import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function CartDrawer({ open, onClose }: CartDrawerProps) {
  const { items, removeItem, updateQuantity, clearCart, removeItems, getByStore, getStoreTotals } =
    useCart();
  const [submitting, setSubmitting] = useState<'kroger' | 'amazon' | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const router = useRouter();

  if (!open) return null;

  const byStore = getByStore();
  const totals = getStoreTotals();

  async function handleKrogerSubmit() {
    const krogerItems = byStore.kroger;
    if (krogerItems.length === 0) return;
    setSubmitting('kroger');
    setMessages([]);
    try {
      const result = await submitCart(krogerItems);
      const authNeeded = result.results.find((r) => r.authUrl);
      if (authNeeded?.authUrl) { window.location.href = authNeeded.authUrl; return; }
      if (result.submittedIds.length > 0) {
        const submittedSet = new Set(result.submittedIds);
        const submittedListItemIds = krogerItems
          .filter((i) => submittedSet.has(i.id) && i.listItemId)
          .map((i) => i.listItemId!);
        removeItems(result.submittedIds);
        if (submittedListItemIds.length > 0) {
          await fetch('/api/list/cleanup-on-cart', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ listItemIds: submittedListItemIds }),
          }).catch(console.error);
          window.dispatchEvent(new CustomEvent('list-status-changed'));
        }
        const failedListItemIds = krogerItems
          .filter((i) => !submittedSet.has(i.id) && i.listItemId)
          .map((i) => i.listItemId!);
        if (failedListItemIds.length > 0) {
          fetch('/api/list/revert-cart', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ listItemIds: failedListItemIds }),
          }).catch(console.error);
          window.dispatchEvent(new CustomEvent('list-status-changed'));
        }
      }
      const r = result.results.find((r) => r.store === 'kroger');
      if (r) setMessages([r.success ? `✅ King Soopers: ${r.itemsAdded} item(s) added` : `❌ King Soopers: ${r.errors.join(', ')}`]);
    } catch {
      setMessages(['Failed to submit to King Soopers. Please try again.']);
    } finally {
      setSubmitting(null);
    }
  }

  async function handleAmazonSubmit() {
    const amazonItems = byStore.amazon;
    if (amazonItems.length === 0) return;
    setSubmitting('amazon');
    setMessages([]);
    try {
      const result = await submitCart(amazonItems);
      if (result.submittedIds.length > 0) {
        const listItemIds = amazonItems
          .filter((i) => result.submittedIds.includes(i.id) && i.listItemId)
          .map((i) => i.listItemId!);
        removeItems(result.submittedIds);
        if (listItemIds.length > 0) {
          await fetch('/api/list/cleanup-on-cart', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ listItemIds }),
          }).catch(console.error);
          window.dispatchEvent(new CustomEvent('list-status-changed'));
        }
      }
      const r = result.results.find((r) => r.store === 'amazon');
      setMessages([r?.success ? `✅ Amazon: ${r.itemsAdded} item(s) added` : '❌ Amazon cart integration coming soon.']);
    } catch {
      setMessages(['Failed to submit to Amazon. Please try again.']);
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-on-surface/30 backdrop-blur-sm z-[998]"
      />

      {/* Drawer */}
      <div className="fixed top-0 right-0 bottom-0 w-[420px] max-w-full bg-white border-l border-[#edeeef] z-[999] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#edeeef] bg-surface-container-low/50">
          <h2 className="text-base font-bold text-on-surface flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
            <span className="material-symbols-outlined text-primary" style={{ fontSize: '20px', fontVariationSettings: "'FILL' 1" }}>shopping_cart</span>
            Cart
            {items.length > 0 && (
              <span className="text-sm font-normal text-outline">({items.length})</span>
            )}
          </h2>
          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <button
                onClick={() => { onClose(); router.push('/compare'); }}
                className="flex items-center gap-1 text-xs font-semibold text-primary border border-primary/20 rounded-lg px-3 py-1.5 hover:bg-primary/5 transition-colors cursor-pointer bg-transparent"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>bar_chart</span>
                Compare
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer bg-transparent border-none"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
            </button>
          </div>
        </div>

        {/* Item list */}
        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="text-center py-16 px-6">
              <span className="material-symbols-outlined text-5xl text-outline/40 block mb-3" style={{ fontVariationSettings: "'FILL' 1" }}>shopping_cart</span>
              <p className="text-sm font-medium text-on-surface-variant">Your cart is empty</p>
              <p className="text-xs text-outline mt-1">Add items from Search or Compare pages</p>
            </div>
          ) : (
            <>
              {byStore.kroger.length > 0 && (
                <StoreSection
                  label="King Soopers"
                  headerClass="bg-primary/5 border-primary/20 text-primary"
                  items={byStore.kroger}
                  total={totals.kroger}
                  onRemove={removeItem}
                  onUpdateQty={updateQuantity}
                />
              )}
              {byStore.amazon.length > 0 && (
                <StoreSection
                  label="Amazon"
                  headerClass="bg-amazon/5 border-amazon/20 text-amazon"
                  items={byStore.amazon}
                  total={totals.amazon}
                  onRemove={removeItem}
                  onUpdateQty={updateQuantity}
                />
              )}
            </>
          )}

          {messages.length > 0 && (
            <div className="mt-4 p-4 rounded-xl bg-surface-container border border-[#edeeef]">
              {messages.map((msg, i) => (
                <p key={i} className={`text-sm ${i > 0 ? 'mt-2' : ''} ${msg.startsWith('✅') ? 'text-primary' : 'text-error'}`}>
                  {msg}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="p-4 border-t border-[#edeeef] bg-surface-container-low/50">
            {/* Total */}
            <div className="flex items-center justify-between mb-4 px-1">
              <span className="text-sm text-on-surface-variant">Estimated total</span>
              <span className="text-xl font-bold text-on-surface" style={{ fontFamily: 'var(--font-display)' }}>
                ${totals.total.toFixed(2)}
              </span>
            </div>

            {byStore.kroger.length > 0 && (
              <button
                onClick={handleKrogerSubmit}
                disabled={submitting !== null}
                className="w-full py-3.5 mb-2 font-bold text-sm rounded-xl bg-primary text-on-primary shadow-[0_2px_0_0_rgba(0,0,0,0.1)] hover:bg-[#0d4430] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-150 border-none cursor-pointer"
              >
                {submitting === 'kroger' ? 'Submitting…' : `Push to King Soopers (${byStore.kroger.length})`}
              </button>
            )}
            {byStore.amazon.length > 0 && (
              <button
                onClick={handleAmazonSubmit}
                disabled={submitting !== null}
                className="w-full py-3.5 mb-2 font-bold text-sm rounded-xl text-on-surface border-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-150 active:scale-[0.98]"
                style={{ backgroundColor: '#FF9900', color: '#111' }}
              >
                {submitting === 'amazon' ? 'Submitting…' : `Push to Amazon (${byStore.amazon.length})`}
              </button>
            )}
            <button
              onClick={clearCart}
              className="w-full py-2 text-xs font-medium text-outline border border-[#bfc9c1] rounded-xl hover:border-error/40 hover:text-error bg-transparent cursor-pointer transition-colors"
            >
              Clear cart
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ── Internal sub-components ─────────────────────────────────────────────────

function StoreSection({
  label, headerClass, items, total, onRemove, onUpdateQty,
}: {
  label: string;
  headerClass: string;
  items: CartItem[];
  total: number;
  onRemove: (id: string) => void;
  onUpdateQty: (id: string, qty: number) => void;
}) {
  return (
    <div className="mb-6">
      <div className={`flex justify-between items-center mb-3 px-3 py-2 rounded-lg border ${headerClass}`}>
        <span className="text-xs font-bold uppercase tracking-wider">
          {label} ({items.length})
        </span>
        <span className="text-sm font-bold">${total.toFixed(2)}</span>
      </div>
      <div className="space-y-1">
        {items.map((item) => (
          <CartItemRow key={item.id} item={item} onRemove={onRemove} onUpdateQty={onUpdateQty} />
        ))}
      </div>
    </div>
  );
}

function CartItemRow({
  item, onRemove, onUpdateQty,
}: {
  item: CartItem;
  onRemove: (id: string) => void;
  onUpdateQty: (id: string, qty: number) => void;
}) {
  const linePrice = item.price > 0 ? `$${(item.price * item.quantity).toFixed(2)}` : 'N/A';

  return (
    <div className="flex gap-3 py-2.5 px-1 items-center border-b border-[#edeeef] last:border-0">
      {item.image_url && (
        <Image
          src={item.image_url}
          alt={item.name}
          width={44}
          height={44}
          className="rounded-lg object-cover flex-shrink-0 bg-surface-container-low"
        />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-on-surface truncate">{item.name}</p>
        <p className="text-xs text-outline mt-0.5 truncate">
          {item.brand}{item.size ? ` · ${item.size}` : ''}
        </p>
      </div>

      {/* Qty stepper */}
      <div className="flex items-center gap-1 flex-shrink-0 bg-surface-container rounded-full border border-[#bfc9c1]/60">
        <button
          onClick={() => item.quantity > 1 ? onUpdateQty(item.id, item.quantity - 1) : onRemove(item.id)}
          className="w-7 h-7 flex items-center justify-center text-outline hover:text-primary rounded-full transition-colors cursor-pointer bg-transparent border-none"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>remove</span>
        </button>
        <span className="w-5 text-center text-xs font-bold text-on-surface">{item.quantity}</span>
        <button
          onClick={() => onUpdateQty(item.id, item.quantity + 1)}
          className="w-7 h-7 flex items-center justify-center text-outline hover:text-primary rounded-full transition-colors cursor-pointer bg-transparent border-none"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span>
        </button>
      </div>

      {/* Price + remove */}
      <div className="text-right flex-shrink-0 min-w-[48px]">
        <div className="text-sm font-bold text-primary">{linePrice}</div>
        <button
          onClick={() => onRemove(item.id)}
          className="text-[10px] text-outline hover:text-error transition-colors cursor-pointer bg-transparent border-none"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

// ── Internal sub-components