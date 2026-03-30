'use client';

import { ProductMatch } from '@/types';
import Image from 'next/image';

interface ProductCardProps {
  product: ProductMatch;
  isSelected: boolean;
  onToggle: () => void;
}

export function ProductCard({ product, isSelected, onToggle }: ProductCardProps) {
  const price = product.price ?? 0;
  const promoPrice = product.promo_price;
  const displayPrice = promoPrice && promoPrice > 0 ? promoPrice : price;

  const storeBg = product.store === 'kroger' 
    ? 'rgba(100, 120, 50, 0.15)' 
    : 'rgba(255, 153, 0, 0.15)';
  
  const storeBorder = product.store === 'kroger'
    ? '1px solid rgba(100, 120, 50, 0.3)'
    : '1px solid rgba(255, 153, 0, 0.3)';

  return (
    <div
      onClick={onToggle}
      style={{
        padding: 'var(--space-md)',
        background: isSelected ? storeBg : 'rgba(255, 255, 255, 0.05)',
        border: isSelected ? storeBorder : '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-sm)',
      }}
    >
      {/* Checkbox */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => {}}
          onClick={(e) => e.stopPropagation()}
          style={{ width: 20, height: 20, cursor: 'pointer' }}
        />
        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: '4px',
            background: product.store === 'kroger' ? 'rgba(100, 120, 50, 0.4)' : 'rgba(255, 153, 0, 0.4)',
            color: product.store === 'kroger' ? '#b8d962' : '#ff9900',
          }}
        >
          {product.store === 'kroger' ? 'KING SOOPERS' : 'AMAZON'}
        </span>
      </div>

      {/* Image */}
      {product.image_url && (
        <div style={{ position: 'relative', width: '100%', height: 120, borderRadius: '4px', overflow: 'hidden' }}>
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            style={{ objectFit: 'cover' }}
            unoptimized
          />
        </div>
      )}

      {/* Name */}
      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f8fafc', lineHeight: 1.3 }}>
        {product.name}
      </div>

      {/* Brand */}
      {product.brand && (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          {product.brand}
        </div>
      )}

      {/* Price */}
      <div style={{ fontSize: '1rem', fontWeight: 700, color: displayPrice > 0 ? 'var(--accent-green)' : 'var(--text-muted)', marginTop: 'auto' }}>
        {displayPrice > 0 ? `$${displayPrice.toFixed(2)}` : 'Price unavailable'}
        {promoPrice && promoPrice > 0 && price > promoPrice && (
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textDecoration: 'line-through', marginLeft: '6px' }}>
            ${price.toFixed(2)}
          </span>
        )}
      </div>

      {/* Size */}
      {product.size && (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {product.size}
        </div>
      )}

      {/* Match Score */}
      {product.match_score != null && product.match_score > 0 && (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Match: {product.match_score}%
        </div>
      )}
    </div>
  );
}
