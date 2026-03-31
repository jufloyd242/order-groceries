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
}

export function ProductCard({
  product,
  isAdded,
  isSelected,
  onToggleSelect,
  isRemembered,
  onSelectRemember,
  radioGroupName = 'remember',
}: ProductCardProps) {
  const price = product.price ?? 0;
  const promoPrice = product.promo_price;
  const displayPrice = promoPrice && promoPrice > 0 ? promoPrice : price;

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

      {/* Info */}
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
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {product.size}
          </div>
        )}
        <div
          style={{
            fontSize: '1rem',
            fontWeight: 700,
            color: displayPrice > 0 ? 'var(--accent-green)' : 'var(--text-muted)',
            marginTop: '4px',
          }}
        >
          {displayPrice > 0 ? `$${displayPrice.toFixed(2)}` : 'Price unavailable'}
          {promoPrice && promoPrice > 0 && price > promoPrice && (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textDecoration: 'line-through', marginLeft: '6px' }}>
              ${price.toFixed(2)}
            </span>
          )}
        </div>
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
