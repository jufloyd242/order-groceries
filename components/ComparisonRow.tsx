'use client';

import { ComparisonResult } from '@/types';
import { useCart } from '@/lib/cart/CartContext';
import Image from 'next/image';
import { useState } from 'react';

interface ComparisonRowProps {
  result: ComparisonResult;
  onPick: (itemId: string, store: 'kroger' | 'amazon') => void;
}

export function ComparisonRow({ result, onPick }: ComparisonRowProps) {
  const { item, selected_kroger, winner, best_fit } = result;
  const { addItem } = useCart();
  const [addedKroger, setAddedKroger] = useState(false);

  // Treat falsy prices (0, undefined) as unavailable
  const krogerPrice = selected_kroger ? ((selected_kroger.promo_price ?? selected_kroger.price) || null) : null;

  // Format the measurement requirement for display
  const measurementLabel = item.quantity_type === 'measurement' && item.min_required_amount
    ? `Need: ${item.quantity}${item.unit ? ' ' + item.unit : ''}`
    : null;

  return (
    <div className="glass-card" style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-md)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 100px', gap: 'var(--space-md)', alignItems: 'center' }}>
        
        {/* Item Info */}
        <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '56px', height: '56px', borderRadius: '8px', overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.05)', flexShrink: 0 }}>
            {selected_kroger?.image_url ? (
              <Image 
                src={selected_kroger?.image_url || ''} 
                alt={item.raw_text}
                fill
                style={{ objectFit: 'contain' }}
              />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: '1.5rem' }}>🛒</div>
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.raw_text}</h3>
            {selected_kroger?.name ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selected_kroger?.name}
              </p>
            ) : (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px', fontStyle: 'italic' }}>No matches found</p>
            )}
            {item.status === 'pending' && (
              <span className="badge badge-amber" style={{ height: 'auto', padding: '2px 6px', fontSize: '0.7rem' }}>⚠️ NEEDS PICK</span>
            )}
            {measurementLabel && (
              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--accent-blue)', fontWeight: 600, marginTop: '2px' }}>
                📏 {measurementLabel}
              </span>
            )}
          </div>
        </div>

        {/* King Soopers Price */}
        <div style={{ textAlign: 'center', minHeight: '72px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>KING SOOPERS</div>
          {krogerPrice !== null ? (
            <div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: winner === 'kroger' ? 'var(--accent-green)' : 'var(--text-primary)' }}>
                ${krogerPrice.toFixed(2)}
              </div>
              {selected_kroger?.promo_price && (
                <div style={{ fontSize: '0.7rem', color: 'var(--accent-red)', textDecoration: 'line-through' }}>
                  Was ${selected_kroger.price.toFixed(2)}
                </div>
              )}
              {selected_kroger?.link && (
                <a href={selected_kroger.link} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: '0.7rem', color: 'var(--accent-blue)', display: 'block', marginTop: '2px' }}>View ↗</a>
              )}
            </div>
          ) : (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Not Found</div>
          )}
          <button 
            onClick={() => onPick(item.id, 'kroger')}
            style={{ border: 'none', background: 'none', color: 'var(--accent-blue)', fontSize: '0.75rem', cursor: 'pointer', padding: '4px 8px', marginTop: '4px' }}
          >
            Change ▼
          </button>
          {krogerPrice !== null && (
            addedKroger ? (
              <div style={{ fontSize: '0.72rem', color: 'var(--accent-green)', fontWeight: 600, marginTop: '2px' }}>✓ Added</div>
            ) : (
              <button
                onClick={() => { addItem(selected_kroger!, item.quantity ?? 1, item.id); setAddedKroger(true); }}
                style={{ marginTop: '2px', padding: '3px 10px', borderRadius: '6px', border: 'none', background: '#84cc16', color: '#0a0a0a', fontWeight: 600, fontSize: '0.72rem', cursor: 'pointer' }}
              >
                + Add
              </button>
            )
          )}
        </div>

        {/* Result/Winner */}
        <div style={{ textAlign: 'right' }}>
          {winner === 'kroger' && krogerPrice !== null && (
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-green)' }}>
                ✅ KS
              </div>
              {best_fit && (
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#0ea5e9', marginTop: '4px', padding: '2px 6px', backgroundColor: 'rgba(14, 165, 233, 0.1)', borderRadius: '4px', display: 'inline-block' }}>
                  🎯 Best Fit
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
