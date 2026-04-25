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
      <span className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 rounded px-1.5 py-0.5 uppercase tracking-wide inline-block mt-0.5">
        Value Size
      </span>
    );
  }
  return (
    <span className="text-[10px] text-outline bg-surface-container border border-[#bfc9c1]/60 rounded px-1.5 py-0.5 uppercase tracking-wide inline-block mt-0.5">
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
    color = '#0f5238'; bg = 'rgba(15,82,56,0.1)'; label = '✓ Strong';
  } else if (score >= 40) {
    color = '#653f00'; bg = 'rgba(101,63,0,0.1)'; label = '~ Fair';
  } else {
    color = '#ba1a1a'; bg = 'rgba(186,26,26,0.1)'; label = '⚠ Weak';
  }

  return (
    <span
      className="relative inline-block"
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
        <span className="absolute bottom-[120%] left-1/2 -translate-x-1/2 bg-on-surface text-inverse-on-surface px-2.5 py-1.5 rounded-lg text-[11px] whitespace-nowrap max-w-[280px] overflow-hidden text-ellipsis z-50 shadow-xl border border-[#404943]/20">
          {reasoning}
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
    <div className="bg-white rounded-2xl border border-[#edeeef] shadow-[0_2px_15px_-3px_rgba(45,106,79,0.08)] mb-4 overflow-hidden">
      <div className="grid p-4 gap-4 items-center" style={{ gridTemplateColumns: '1.5fr 1fr 1fr 100px' }}>

        {/* Item Info */}
        <div className="flex gap-3 items-center">
          <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-surface-container-low flex-shrink-0 border border-[#edeeef]">
            {(selected_kroger?.image_url || selected_amazon?.image_url) ? (
              <Image
                src={selected_kroger?.image_url || selected_amazon?.image_url || ''}
                alt={item.raw_text}
                fill
                style={{ objectFit: 'contain' }}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <span className="material-symbols-outlined text-outline" style={{ fontSize: '24px', fontVariationSettings: "'FILL' 1" }}>shopping_basket</span>
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-on-surface truncate">{item.raw_text}</h3>
            {(selected_kroger?.name || selected_amazon?.name) ? (
              <p className="text-xs text-on-surface-variant mt-0.5 truncate">
                {selected_kroger?.name || selected_amazon?.name}
              </p>
            ) : (
              <p className="text-xs text-outline mt-0.5 italic">No matches found</p>
            )}
            {item.status === 'pending' && (
              <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-error-container text-error border border-error/20">
                <span className="material-symbols-outlined" style={{ fontSize: '10px' }}>warning</span>
                NEEDS PICK
              </span>
            )}
          </div>
        </div>

        {/* King Soopers Price */}
        <div className="text-center flex flex-col items-center justify-center min-h-[72px]">
          <div className="text-[10px] text-outline mb-1 font-bold tracking-wider uppercase">King Soopers</div>
          {krogerPrice !== null ? (
            <div>
              <div className={`text-lg font-bold ${winner === 'kroger' ? 'text-primary' : 'text-on-surface'}`}>
                ${krogerPrice.toFixed(2)}
              </div>
              {selected_kroger && (selected_kroger.price_per_unit ?? 0) > 0 && selected_kroger.unit && (
                <div className="text-[11px] font-semibold text-on-surface-variant">
                  ${selected_kroger.price_per_unit.toFixed(2)}&nbsp;/&nbsp;{selected_kroger.unit}
                </div>
              )}
              {selected_kroger?.promo_price && (
                <div className="text-[11px] text-error line-through">
                  Was ${selected_kroger.price.toFixed(2)}
                </div>
              )}
              <SizeScaleBadge label={krogerSizeLabel} />
              <ConfidenceBadge product={selected_kroger} />
              {selected_kroger?.link && (
                <a href={selected_kroger.link} target="_blank" rel="noopener noreferrer"
                  className="text-[11px] text-kroger block mt-0.5 hover:underline">View ↗</a>
              )}
            </div>
          ) : (
            <div className="text-sm text-outline italic">Not Found</div>
          )}
          <button
            onClick={() => onPick(item.id, 'kroger')}
            className="text-xs text-kroger bg-transparent border-none cursor-pointer px-2 py-1 mt-1 hover:underline"
          >
            Change ▼
          </button>
          {krogerPrice !== null && (
            addedKroger ? (
              <div className="text-[11px] text-primary font-bold mt-0.5 flex items-center gap-1">
                <span className="material-symbols-outlined" style={{ fontSize: '12px', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                Added
              </div>
            ) : (
              <button
                onClick={() => { addItem(selected_kroger!, item.quantity ?? 1, item.id); setAddedKroger(true); }}
                className="mt-1 px-3 py-1 rounded-lg bg-primary text-on-primary font-bold text-[11px] border-none cursor-pointer hover:bg-[#0d4430] transition-colors"
              >
                + Add
              </button>
            )
          )}
        </div>

        {/* Amazon Price */}
        <div className="text-center flex flex-col items-center justify-center min-h-[72px]">
          <div className="text-[10px] text-outline mb-1 font-bold tracking-wider uppercase">Amazon</div>
          {amazonPrice !== null && amazonPrice > 0 ? (
            <div>
              <div className={`text-lg font-bold ${winner === 'amazon' ? 'text-primary' : 'text-on-surface'}`}>
                ${amazonPrice.toFixed(2)}
              </div>
              {selected_amazon && (selected_amazon.price_per_unit ?? 0) > 0 && selected_amazon.unit && (
                <div className="text-[11px] font-semibold text-on-surface-variant">
                  ${selected_amazon.price_per_unit.toFixed(2)}&nbsp;/&nbsp;{selected_amazon.unit}
                </div>
              )}
              {selected_amazon?.is_prime && (
                <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded border mt-0.5" style={{ background: '#232f3e', color: '#ff9900', borderColor: '#ff9900' }}>Prime</span>
              )}
              <SizeScaleBadge label={amazonSizeLabel} />
              <ConfidenceBadge product={selected_amazon} />
              {selected_amazon?.link && (
                <a href={selected_amazon.link} target="_blank" rel="noopener noreferrer"
                  className="text-[11px] text-amazon block mt-0.5 hover:underline">View ↗</a>
              )}
            </div>
          ) : selected_amazon ? (
            <div className="text-sm text-outline text-center">
              <div className="italic mb-1">Price unavailable</div>
              {selected_amazon.link && (
                <a href={selected_amazon.link} target="_blank" rel="noopener noreferrer"
                  className="text-amazon text-xs font-semibold no-underline hover:underline">
                  Check on Amazon ↗
                </a>
              )}
            </div>
          ) : isAmazonSearched ? (
            <div className="text-sm text-outline italic">No Close Match Found</div>
          ) : (
            <div className="text-sm text-outline italic">Not searched</div>
          )}
          <button
            onClick={() => onPick(item.id, 'amazon')}
            className="text-xs text-kroger bg-transparent border-none cursor-pointer px-2 py-1 mt-1 hover:underline"
          >
            Change ▼
          </button>
          {amazonPrice !== null && amazonPrice > 0 && (
            addedAmazon ? (
              <div className="text-[11px] text-primary font-bold mt-0.5 flex items-center gap-1">
                <span className="material-symbols-outlined" style={{ fontSize: '12px', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                Added
              </div>
            ) : (
              <button
                onClick={() => { addItem(selected_amazon!, item.quantity ?? 1, item.id); setAddedAmazon(true); }}
                className="mt-1 px-3 py-1 rounded-lg font-bold text-[11px] border-none cursor-pointer transition-colors"
                style={{ backgroundColor: '#ff9900', color: '#0a0a0a' }}
              >
                + Add
              </button>
            )
          )}
        </div>

        {/* Result/Winner */}
        <div className="text-right">
          {winner !== 'tie' && (
            <div>
              <div className="flex items-center justify-end gap-1 text-sm font-bold text-primary">
                <span className="material-symbols-outlined" style={{ fontSize: '14px', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                {winner === 'kroger' ? 'KS' : 'AMZ'}
              </div>
              <div className="text-xs text-on-surface-variant mt-0.5">
                Save ${savings.toFixed(2)}
              </div>
              {result.savings_note && (
                <div className="text-[10px] text-outline mt-0.5 leading-snug break-words">
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
