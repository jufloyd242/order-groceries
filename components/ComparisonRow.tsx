'use client';

import { ComparisonResult, ProductMatch } from '@/types';
import { useCart } from '@/lib/cart/CartContext';
import Image from 'next/image';
import { useState } from 'react';
import { parseProductSize } from '@/lib/matching/normalize';

// ─── Size Scale Badge ─────────────────────────────────────────

function SizeScaleBadge({ label }: { label: 'value' | 'compact' | null }) {
  if (!label) return null;
  if (label === 'value') {
    return (
      <span style={{
        fontSize: '0.62rem', fontWeight: 700, color: '#4ade80',
        background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)',
        borderRadius: '3px', padding: '1px 5px', textTransform: 'uppercase', letterSpacing: '0.04em',
        display: 'inline-block', marginTop: '2px',
      }}>
        Value Size
      </span>
    );
  }
  return (
    <span style={{
      fontSize: '0.62rem', color: '#94a3b8',
      background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.2)',
      borderRadius: '3px', padding: '1px 5px', textTransform: 'uppercase', letterSpacing: '0.04em',
      display: 'inline-block', marginTop: '2px',
    }}>
      Compact
    </span>
  );
}

function getSizeScaleLabel(
  thisProduct: ProductMatch | null,
  otherProduct: ProductMatch | null,
): 'value' | 'compact' | null {
  if (!thisProduct?.size || !otherProduct?.size) return null;
  const a = parseProductSize(thisProduct.size);
  const b = parseProductSize(otherProduct.size);
  if (!a || !b || a.baseUnit !== b.baseUnit || b.totalQty === 0) return null;
  const ratio = a.totalQty / b.totalQty;
  if (ratio >= 1.5) return 'value';
  if (ratio <= 1 / 1.5) return 'compact';
  return null;
}

function ConfidenceBadge({ product }: { product: ProductMatch | null }) {
  const [showTooltip, setShowTooltip] = useState(false);
  if (!product) return null;
  const score = product.match_score;
  const reasoning = product.ai_reasoning;

  let color: string;
  let bg: string;
  let label: string;
  if (score >= 80) {
    color = '#22c55e'; bg = 'rgba(34,197,94,0.12)'; label = '✓ Strong';
  } else if (score >= 40) {
    color = '#eab308'; bg = 'rgba(234,179,8,0.12)'; label = '~ Fair';
  } else {
    color = '#f87171'; bg = 'rgba(248,113,113,0.12)'; label = '⚠ Weak';
  }

  return (
    <span
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span style={{
        fontSize: '0.65rem', fontWeight: 600, color, backgroundColor: bg,
        padding: '1px 6px', borderRadius: '4px', border: `1px solid ${color}`,
        cursor: reasoning ? 'help' : 'default',
      }}>
        {label} {score}%
      </span>
      {showTooltip && reasoning && (
        <span style={{
          position: 'absolute', bottom: '120%', left: '50%', transform: 'translateX(-50%)',
          backgroundColor: '#1e1e2e', color: '#e0e0e0', padding: '6px 10px', borderRadius: '6px',
          fontSize: '0.7rem', whiteSpace: 'nowrap', maxWidth: '280px', overflow: 'hidden',
          textOverflow: 'ellipsis', zIndex: 50, boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}>
          🤖 {reasoning}
        </span>
      )}
    </span>
  );
}

interface ComparisonRowProps {
  result: ComparisonResult;
  onPick: (itemId: string, store: 'kroger' | 'amazon') => void;
  /** True when the compare API was called with ?amazon=true — distinguishes "Not Found" from "Not Searched" */
  isAmazonSearched?: boolean;
}

export function ComparisonRow({ result, onPick, isAmazonSearched = false }: ComparisonRowProps) {
  const { item, selected_kroger, selected_amazon, winner, savings } = result;
  const { addItem } = useCart();
  const [addedKroger, setAddedKroger] = useState(false);
  const [addedAmazon, setAddedAmazon] = useState(false);

  // Treat falsy prices (0, undefined) as unavailable
  const krogerPrice = selected_kroger ? ((selected_kroger.promo_price ?? selected_kroger.price) || null) : null;
  // Treat $0 as unavailable (SerpApi free tier limitation)
  const amazonPrice = selected_amazon ? ((selected_amazon.promo_price ?? selected_amazon.price) || null) : null;

  // Size scale labels (Value Size / Compact) — compare the two selected products
  const krogerSizeLabel = getSizeScaleLabel(selected_kroger, selected_amazon);
  const amazonSizeLabel = getSizeScaleLabel(selected_amazon, selected_kroger);

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
              {selected_kroger && (selected_kroger.price_per_unit ?? 0) > 0 && selected_kroger.unit && (
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  ${selected_kroger.price_per_unit.toFixed(2)}&nbsp;/&nbsp;{selected_kroger.unit}
                </div>
              )}
              {selected_kroger?.promo_price && (
                <div style={{ fontSize: '0.7rem', color: 'var(--accent-red)', textDecoration: 'line-through' }}>
                  Was ${selected_kroger.price.toFixed(2)}
                </div>
              )}
              <SizeScaleBadge label={krogerSizeLabel} />
              <ConfidenceBadge product={selected_kroger} />
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

        {/* Amazon Price */}
        <div style={{ textAlign: 'center', minHeight: '72px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>AMAZON</div>
          {amazonPrice !== null && amazonPrice > 0 ? (
            <div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: winner === 'amazon' ? 'var(--accent-green)' : 'var(--text-primary)' }}>
                ${amazonPrice.toFixed(2)}
              </div>
              {selected_amazon && (selected_amazon.price_per_unit ?? 0) > 0 && selected_amazon.unit && (
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  ${selected_amazon.price_per_unit.toFixed(2)}&nbsp;/&nbsp;{selected_amazon.unit}
                </div>
              )}
              {selected_amazon?.is_prime && (
                <span className="badge" style={{ backgroundColor: '#232f3e', color: '#ff9900', border: '1px solid #ff9900', fontSize: '0.6rem', padding: '1px 4px' }}>Prime</span>
              )}
              <SizeScaleBadge label={amazonSizeLabel} />
              <ConfidenceBadge product={selected_amazon} />
              {selected_amazon?.link && (
                <a href={selected_amazon.link} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: '0.7rem', color: 'var(--accent-blue)', display: 'block', marginTop: '2px' }}>View ↗</a>
              )}
            </div>
          ) : selected_amazon ? (
            /* Product was found but price is unavailable (common on SerpApi free tier) */
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              <div style={{ fontStyle: 'italic', marginBottom: '4px' }}>Price unavailable</div>
              {selected_amazon.link && (
                <a href={selected_amazon.link} target="_blank" rel="noopener noreferrer"
                  style={{ color: '#ff9900', fontSize: '0.75rem', fontWeight: 600, textDecoration: 'none' }}>
                  Check on Amazon ↗
                </a>
              )}
            </div>
          ) : isAmazonSearched ? (
            /* Amazon was searched but returned no match for this item */
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No Close Match Found</div>
          ) : (
            /* Amazon wasn't included in this comparison run */
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Not searched</div>
          )}
          <button 
            onClick={() => onPick(item.id, 'amazon')}
            style={{ border: 'none', background: 'none', color: 'var(--accent-blue)', fontSize: '0.75rem', cursor: 'pointer', padding: '4px 8px', marginTop: '4px' }}
          >
            Change ▼
          </button>
          {amazonPrice !== null && amazonPrice > 0 && (
            addedAmazon ? (
              <div style={{ fontSize: '0.72rem', color: 'var(--accent-green)', fontWeight: 600, marginTop: '2px' }}>✓ Added</div>
            ) : (
              <button
                onClick={() => { addItem(selected_amazon!, item.quantity ?? 1, item.id); setAddedAmazon(true); }}
                style={{ marginTop: '2px', padding: '3px 10px', borderRadius: '6px', border: 'none', background: '#ff9900', color: '#0a0a0a', fontWeight: 600, fontSize: '0.72rem', cursor: 'pointer' }}
              >
                + Add
              </button>
            )
          )}
        </div>

        {/* Result/Winner */}
        <div style={{ textAlign: 'right' }}>
          {winner !== 'tie' && (
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-green)' }}>
                ✅ {winner === 'kroger' ? 'KS' : 'AMZ'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Save ${savings.toFixed(2)}
              </div>
              {result.savings_note && (
                <div style={{
                  fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: '3px', lineHeight: 1.4,
                  wordBreak: 'break-word',
                }}>
                  {result.savings_note}
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
