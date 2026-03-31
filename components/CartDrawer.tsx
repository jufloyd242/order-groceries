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
      if (authNeeded?.authUrl) {
        window.location.href = authNeeded.authUrl;
        return;
      }
      if (result.submittedIds.length > 0) {
        const submittedSet = new Set(result.submittedIds);
        const submittedListItemIds = krogerItems
          .filter((i) => submittedSet.has(i.id) && i.listItemId)
          .map((i) => i.listItemId!);
        removeItems(result.submittedIds);
        if (submittedListItemIds.length > 0) {
          fetch('/api/list/cleanup-on-cart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ listItemIds: submittedListItemIds }),
          }).catch((err) => console.error('Cleanup error:', err));
        }
        // Revert list items for any cart items that FAILED submission
        const failedListItemIds = krogerItems
          .filter((i) => !submittedSet.has(i.id) && i.listItemId)
          .map((i) => i.listItemId!);
        if (failedListItemIds.length > 0) {
          fetch('/api/list/revert-cart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ listItemIds: failedListItemIds }),
          }).catch((err) => console.error('Revert error:', err));
          window.dispatchEvent(new CustomEvent('list-status-changed'));
        }
      }
      const r = result.results.find((r) => r.store === 'kroger');
      if (r) {
        setMessages([r.success
          ? `✅ King Soopers: ${r.itemsAdded} item(s) added to cart`
          : `❌ King Soopers: ${r.errors.join(', ')}`]);
      }
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
          fetch('/api/list/cleanup-on-cart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ listItemIds }),
          }).catch((err) => console.error('Cleanup error:', err));
        }
      }
      const r = result.results.find((r) => r.store === 'amazon');
      setMessages([r?.success
        ? `✅ Amazon: ${r.itemsAdded} item(s) added to cart`
        : '❌ Amazon cart integration coming soon.']);
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
        style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
          zIndex: 998,
        }}
      />

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: '420px', maxWidth: '100vw',
        backgroundColor: '#0f172a', borderLeft: '1px solid rgba(255,255,255,0.08)',
        zIndex: 999, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.4)',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
            🛒 Cart {items.length > 0 && <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>({items.length})</span>}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {items.length > 0 && (
              <button
                onClick={() => { onClose(); router.push('/compare'); }}
                style={{ background: 'none', color: '#94a3b8', fontSize: '0.82rem', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                📊 Compare
              </button>
            )}
            <button onClick={onClose} style={{
              background: 'none', border: 'none', color: '#94a3b8',
              fontSize: '1.4rem', cursor: 'pointer', lineHeight: 1, padding: '4px',
            }}>✕</button>
          </div>
        </div>

        {/* Scrollable item list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: '#64748b' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🛒</div>
              <p style={{ margin: 0, fontSize: '0.95rem' }}>Your cart is empty</p>
              <p style={{ margin: '8px 0 0', fontSize: '0.8rem' }}>
                Add items from the Search or Compare pages
              </p>
            </div>
          ) : (
            <>
              {/* King Soopers items */}
              {byStore.kroger.length > 0 && (
                <StoreSection
                  label="King Soopers"
                  color="#4ade80"
                  items={byStore.kroger}
                  total={totals.kroger}
                  onRemove={removeItem}
                  onUpdateQty={updateQuantity}
                />
              )}

              {/* Amazon items */}
              {byStore.amazon.length > 0 && (
                <StoreSection
                  label="Amazon"
                  color="#ff9900"
                  items={byStore.amazon}
                  total={totals.amazon}
                  onRemove={removeItem}
                  onUpdateQty={updateQuantity}
                />
              )}
            </>
          )}

        {/* Result messages */}
          {messages.length > 0 && (
            <div style={{
              marginTop: '16px', padding: '14px', borderRadius: '8px',
              backgroundColor: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}>
              {messages.map((msg, i) => (
                <p key={i} style={{ margin: i === 0 ? 0 : '8px 0 0', fontSize: '0.88rem', color: '#cbd5e1' }}>
                  {msg}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: '14px',
            }}>
              <span style={{ fontSize: '0.95rem', color: '#94a3b8' }}>Estimated total</span>
              <span style={{ fontSize: '1.3rem', fontWeight: 700 }}>${totals.total.toFixed(2)}</span>
            </div>
            {byStore.kroger.length > 0 && (
              <button
                className="btn btn-primary btn-lg"
                onClick={handleKrogerSubmit}
                disabled={submitting !== null}
                style={{ width: '100%', padding: '14px', fontSize: '1rem', marginBottom: '8px', background: '#4ade80', borderColor: '#4ade80', color: '#000' }}
              >
                {submitting === 'kroger' ? '🛒 Submitting...' : `Push to King Soopers (${byStore.kroger.length})`}
              </button>
            )}
            {byStore.amazon.length > 0 && (
              <button
                className="btn btn-primary btn-lg"
                onClick={handleAmazonSubmit}
                disabled={submitting !== null}
                style={{ width: '100%', padding: '14px', fontSize: '1rem', marginBottom: '8px', background: '#ff9900', borderColor: '#ff9900', color: '#000' }}
              >
                {submitting === 'amazon' ? '🛒 Submitting...' : `Push to Amazon (${byStore.amazon.length})`}
              </button>
            )}
            <button
              onClick={clearCart}
              style={{
                width: '100%', padding: '8px', background: 'none',
                border: '1px solid rgba(255,255,255,0.1)', color: '#64748b',
                borderRadius: '8px', cursor: 'pointer', fontSize: '0.82rem',
              }}
            >
              Clear cart
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function StoreSection({
  label, color, items, total, onRemove, onUpdateQty,
}: {
  label: string;
  color: string;
  items: CartItem[];
  total: number;
  onRemove: (id: string) => void;
  onUpdateQty: (id: string, qty: number) => void;
}) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '12px', paddingBottom: '8px',
        borderBottom: `1px solid ${color}30`,
      }}>
        <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
          {label} ({items.length})
        </h3>
        <span style={{ fontSize: '0.88rem', fontWeight: 600, color }}>${total.toFixed(2)}</span>
      </div>
      {items.map((item) => (
        <CartItemRow key={item.id} item={item} onRemove={onRemove} onUpdateQty={onUpdateQty} />
      ))}
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
    <div style={{
      display: 'flex', gap: '12px', padding: '10px 0',
      borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'center',
    }}>
      {item.image_url && (
        <Image
          src={item.image_url}
          alt={item.name}
          width={44}
          height={44}
          style={{ borderRadius: 6, objectFit: 'cover', flexShrink: 0, background: '#1e293b' }}
        />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '0.88rem', fontWeight: 600,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {item.name}
        </div>
        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
          {item.brand}{item.size ? ` · ${item.size}` : ''}
        </div>
      </div>

      {/* Qty stepper */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
        <button
          onClick={() => item.quantity > 1 ? onUpdateQty(item.id, item.quantity - 1) : onRemove(item.id)}
          style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.12)', background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >−</button>
        <span style={{ minWidth: 18, textAlign: 'center', fontSize: '0.88rem', fontWeight: 600 }}>
          {item.quantity}
        </span>
        <button
          onClick={() => onUpdateQty(item.id, item.quantity + 1)}
          style={{ width: 26, height: 26, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.12)', background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >+</button>
      </div>

      {/* Price + remove */}
      <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 52 }}>
        <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{linePrice}</div>
        <button
          onClick={() => onRemove(item.id)}
          style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.68rem', cursor: 'pointer', padding: '2px 0' }}
        >Remove</button>
      </div>
    </div>
  );
}
