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
      className={`p-4 rounded-xl border flex gap-3 items-center transition-all ${
        isAdded
          ? 'bg-primary/5 border-primary/25'
          : isSelected
            ? 'bg-primary/[0.04] border-primary/15'
            : 'bg-white border-[#edeeef]'
      }`}
    >
      {/* Select checkbox */}
      <div className="flex-shrink-0 flex items-center">
        {isAdded ? (
          <span className="material-symbols-outlined text-primary" style={{ fontSize: '20px', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
        ) : (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="w-[18px] h-[18px] cursor-pointer accent-primary"
            aria-label={`Select ${product.name}`}
          />
        )}
      </div>

      {/* Image */}
      {product.image_url && (
        <div
          className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-surface-container-low border border-[#edeeef]"
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

      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-on-surface leading-snug">
          {product.name}
        </div>
        {product.brand && (
          <div className="text-xs text-on-surface-variant mt-0.5">
            {product.brand}
          </div>
        )}
        {product.size && (
          <span className="inline-block mt-0.5 text-[11px] font-bold tracking-wide text-outline bg-surface-container border border-[#bfc9c1]/60 rounded px-1.5 py-0.5 uppercase">
            {product.size}
          </span>
        )}
        <div className="text-base font-bold mt-1 flex items-center gap-2 flex-wrap">
          <span className={displayPrice > 0 ? 'text-primary' : 'text-outline'}>
            {displayPrice > 0 ? `$${displayPrice.toFixed(2)}` : 'Price unavailable'}
          </span>
          {promoPrice && promoPrice > 0 && price > promoPrice && (
            <span className="text-xs text-outline line-through">
              ${price.toFixed(2)}
            </span>
          )}
          {isStockUpPrice && (
            <span
              className="text-[11px] font-bold text-[#052e16] bg-[#4ade80] rounded px-1.5 py-0.5 tracking-tight"
              title={`${Math.round((1 - displayPrice / historicalAvg!) * 100)}% below your avg of $${historicalAvg!.toFixed(2)}`}
            >
              Stock Up!
            </span>
          )}
        </div>
        {displayPrice > 0 && product.price_per_unit > 0 && product.unit && (
          <div className="text-[11px] font-semibold text-on-surface-variant mt-0.5">
            ${product.price_per_unit.toFixed(2)}&nbsp;/&nbsp;{product.unit}
          </div>
        )}
      </div>

      {/* Remember radio */}
      {onSelectRemember && (
        <label
          className={`flex-shrink-0 flex items-center gap-1 cursor-pointer text-[11px] px-2 py-1 border rounded-lg transition-all whitespace-nowrap ${
            isRemembered
              ? 'text-primary border-primary/30 bg-primary/8'
              : 'text-on-surface-variant border-[#edeeef] bg-transparent'
          }`}
        >
          <input
            type="radio"
            name={radioGroupName}
            checked={!!isRemembered}
            onChange={onSelectRemember}
            className="w-3 h-3 accent-primary"
          />
          <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>bookmark</span>
          Remember
        </label>
      )}
    </div>
  );
}
