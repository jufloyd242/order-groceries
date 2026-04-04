'use client';

import { ComparisonResult, ProductMatch } from '@/types';
import { useCart } from '@/lib/cart/CartContext';
import Image from 'next/image';
import { useState } from 'react';

interface ComparisonRowProps {
  result: ComparisonResult;
  onPick: (itemId: string, store: 'kroger' | 'amazon') => void;
}

export function ComparisonRow({ result, onPick }: ComparisonRowProps) {
  const { item, selected_kroger, selected_amazon, winner, savings } = result;
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  // Treat falsy prices (0, undefined) as unavailable
  const krogerPrice = selected_kroger ? ((selected_kroger.promo_price ?? selected_kroger.price) || null) : null;
  // Treat $0 as unavailable (SerpApi free tier limitation)
  const amazonPrice = selected_amazon ? ((selected_amazon.promo_price ?? selected_amazon.price) || null) : null;

  return (
    <div className="glass-card" style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-md)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 100px', gap: 'var(--space-md)', alignItems: 'center' }}>
        
        {/* Item Info */}
        <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '56px', height: '56px', borderRadius: '8px', overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.05)', flexShrink: 0 }}>
            {(selected_kroger?.image_url || selected_amazon?.image_url) ? (
              <Image 
                src={selected_kroger?.image_url || selected_amazon?.image_url || ''} 
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
            {(selected_kroger?.name || selected_amazon?.name) ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selected_kroger?.name || selected_amazon?.name}
              </p>
            ) : (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px', fontStyle: 'italic' }}>No matches found</p>
            )}
            {item.status === 'pending' && (
              <span className="badge badge-amber" style={{ height: 'auto', padding: '2px 6px', fontSize: '0.7rem' }}>⚠️ NEEDS PICK</span>
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
            Change KS ▼
          </button>
        </div>

        {/* Amazon Price */}
        <div style={{ textAlign: 'center', minHeight: '72px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>AMAZON</div>
          {amazonPrice !== null && amazonPrice > 0 ? (
            <div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: winner === 'amazon' ? 'var(--accent-green)' : 'var(--text-primary)' }}>
                ${amazonPrice.toFixed(2)}
              </div>
              {selected_amazon?.is_prime && (
                <span className="badge" style={{ backgroundColor: '#232f3e', color: '#ff9900', border: '1px solid #ff9900', fontSize: '0.6rem', padding: '1px 4px' }}>Prime</span>
              )}
              {selected_amazon?.link && (
                <a href={selected_amazon.link} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: '0.7rem', color: 'var(--accent-blue)', display: 'block', marginTop: '2px' }}>View ↗</a>
              )}
            </div>
          ) : (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', maxWidth: '80px' }}>Price Unavailable</div>
          )}
          <button 
            onClick={() => onPick(item.id, 'amazon')}
            style={{ border: 'none', background: 'none', color: 'var(--accent-blue)', fontSize: '0.75rem', cursor: 'pointer', padding: '4px 8px', marginTop: '4px' }}
          >
            Change AMZ ▼
          </button>
        </div>

        {/* Result/Winner */}
        <div style={{ textAlign: 'right' }}>
          {winner === 'tie' ? (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>-</div>
          ) : (
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-green)' }}>
                ✅ {winner === 'kroger' ? 'KS' : 'AMZ'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Save ${savings.toFixed(2)}
              </div>
            </div>
          )}
          {!added ? (
            <button
              onClick={() => {
                const product = winner === 'amazon' ? selected_amazon : selected_kroger;
                if (product) {
                  addItem(product, item.quantity ?? 1, item.id);
                  setAdded(true);
                }
              }}
              disabled={!selected_kroger && !selected_amazon}
              style={{
                marginTop: '6px',
                padding: '4px 10px',
                borderRadius: '6px',
                border: 'none',
                background: '#84cc16',
                color: '#0a0a0a',
                fontWeight: 600,
                fontSize: '0.72rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              + Add
            </button>
          ) : (
            <div style={{ marginTop: '6px', fontSize: '0.72rem', color: 'var(--accent-green)', fontWeight: 600 }}>✓ Added</div>
          )}
        </div>

      </div>
    </div>
  );
}
