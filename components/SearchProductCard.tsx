'use client';

import { ProductMatch } from '@/types';
import Image from 'next/image';

interface ProductCardProps {
  product: ProductMatch;
  /** Product key is already in the cart (post-submit). Shows ✓ Added state. */
  isAdded: boolean;
  /** Whether this card's checkbox is checked for batch-add selection. */
  isSelected: boolean;
  onToggleSelect: () => void;
  /** Whether this card's radio button is selected as the remembered preference. */
  isRemembered?: boolean;
  /** Called when the radio button is clicked. Set-only (not a toggle). */
  onSelectRemember?: () => void;
  /** Radio group name — callers scope this per search context to enforce mutual exclusivity. */
  radioGroupName?: string;
  /** Historical average price for this product. If current price is ≥15% below, show Stock Up badge. */
  historicalAvg?: number | null;
}

export function ProductCard({
  product,
  isAdded,
  isSelected,
  onToggleSelect,
  isRemembered,
  onSelectRemember,
  radioGroupName = 'remember',
  historicalAvg,
}: ProductCardProps) {
  const price = product.price ?? 0;
  const promoPrice = product.promo_price;
  const displayPrice = promoPrice && promoPrice > 0 ? promoPrice : price;
  const isStockUpPrice =
    historicalAvg != null &&
    historicalAvg > 0 &&
    displayPrice > 0 &&
    displayPrice <= historicalAvg * 0.85;

  return (
    <div
      style={{
        padding: 'var(--space-md)',
        background: isAdded
          ? 'rgba(34, 197, 94, 0.08)'
          : isSelected
            ? 'rgba(132, 204, 22, 0.06)'
            : 'rgba(255, 255, 255, 0.05)',
        border: isAdded
          ? '1px solid rgba(34, 197, 94, 0.3)'
          : isSelected
            ? '1px solid rgba(132, 204, 22, 0.35)'
            : '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '8px',
        display: 'flex',
        gap: 'var(--space-md)',
        alignItems: 'center',
        transition: 'all 0.2s ease',
      }}
    >
      {/* Select checkbox */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        {isAdded ? (
          <span style={{ fontSize: '1.1rem' }}>✓</span>
        ) : (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            style={{ width: 18, height: 18, accentColor: '#84cc16', cursor: 'pointer' }}
            aria-label={`Select ${product.name}`}
          />
        )}
      </div>

      {/* Image */}
      {product.image_url && (
        <div
          style={{
            position: 'relative',
            width: 64,
            height: 64,
            borderRadius: '6px',
            overflow: 'hidden',
            flexShrink: 0,
            background: '#1e293b',
          }}
        >
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            style={{ objectFit: 'contain' }}
            unoptimized
          />
        </div>
      )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f8fafc', lineHeight: 1.3 }}>
            {product.name}
          </div>
          {product.brand && (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {product.brand}
            </div>
          )}
          {product.size && (
            <span style={{
              display: 'inline-block', marginTop: '3px',
              fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.05em',
              color: '#94a3b8', background: 'rgba(148,163,184,0.12)',
              border: '1px solid rgba(148,163,184,0.22)', borderRadius: '4px',
              padding: '1px 6px', textTransform: 'uppercase',
            }}>
              {product.size}
            </span>
          )}
          <div
            style={{
              fontSize: '1rem',
              fontWeight: 700,
              color: displayPrice > 0 ? 'var(--accent-green)' : 'var(--text-muted)',
              marginTop: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'wrap',
            }}
          >
            {displayPrice > 0 ? `$${displayPrice.toFixed(2)}` : 'Price unavailable'}
            {promoPrice && promoPrice > 0 && price > promoPrice && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                ${price.toFixed(2)}
              </span>
            )}
            {isStockUpPrice && (
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: '#052e16',
                  background: '#4ade80',
                  borderRadius: '4px',
                  padding: '2px 6px',
                  letterSpacing: '0.01em',
                }}
                title={`${Math.round((1 - displayPrice / historicalAvg!) * 100)}% below your avg of $${historicalAvg!.toFixed(2)}`}
              >
                🔥 Stock Up Price!
              </span>
            )}
          </div>
          {displayPrice > 0 && product.price_per_unit > 0 && product.unit && (
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '1px' }}>
              ${product.price_per_unit.toFixed(2)}&nbsp;/&nbsp;{product.unit}
            </div>
          )}
        </div>

      {/* Remember radio (only shown when in a search context with an itemId/listItemId) */}
      {onSelectRemember && (
        <label
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            cursor: 'pointer',
            fontSize: '0.72rem',
            color: isRemembered ? '#84cc16' : '#64748b',
            padding: '4px 8px',
            border: `1px solid ${isRemembered ? '#84cc16' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: '6px',
            background: isRemembered ? 'rgba(132, 204, 22, 0.1)' : 'none',
            transition: 'all 0.15s',
            whiteSpace: 'nowrap',
          }}
        >
          <input
            type="radio"
            name={radioGroupName}
            checked={!!isRemembered}
            onChange={onSelectRemember}
            style={{ accentColor: '#84cc16', width: 13, height: 13 }}
          />
          💾 Remember
        </label>
      )}
    </div>
  );
}
