'use client';

import { useState, useRef } from 'react';
import type { UIListItem } from '@/types';

// Re-export alias so existing callers (page.tsx) need no change
export type ListItemData = UIListItem;

interface ListItemProps {
  item: ListItemData;
  index: number;
  onRemove: (id: string) => void;
  selected: boolean;
  skipped?: boolean;
  onToggle: (id: string) => void;
  onTogglePersistent: (id: string) => void;
  onQuantityChange: (id: string, qty: number) => void;
  onSkip: (id: string) => void;
  onRename: (id: string, newText: string) => void;
  onSearch?: (id: string, query: string) => void;
}

// Department → Material Symbols icon name
const DEPT_ICON: Record<string, string> = {
  Produce: 'nutrition', Bakery: 'bakery_dining', Deli: 'lunch_dining',
  Meat: 'kebab_dining', Seafood: 'set_meal', Dairy: 'egg',
  Frozen: 'ac_unit', Beverages: 'local_cafe', Snacks: 'cookie',
  Pantry: 'kitchen', Household: 'cleaning_services', 'Personal Care': 'face',
  'Pet Care': 'pets', Other: 'shopping_basket',
};

// Department → emoji fallback (when Material Symbols not loaded)
const DEPT_EMOJI: Record<string, string> = {
  Produce: '🥦', Bakery: '🍞', Deli: '🧀', Meat: '🥩', Seafood: '🐟',
  Dairy: '🥛', Frozen: '🧊', Beverages: '🥤', Snacks: '🍿', Pantry: '🥫',
  Household: '🧹', 'Personal Care': '🧴', 'Pet Care': '🐾', Other: '🛒',
};

function deptEmoji(dept?: string | null): string {
  if (!dept) return '🛒';
  return DEPT_EMOJI[dept] ?? '🛒';
}

export function ListItem({
  item,
  index,
  onRemove,
  selected,
  skipped = false,
  onToggle,
  onTogglePersistent,
  onQuantityChange,
  onSkip,
  onRename,
  onSearch,
}: ListItemProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const editRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    if (isLocked) return;
    setEditValue(item.raw_text);
    setEditing(true);
    setTimeout(() => editRef.current?.select(), 0);
  }

  function commitEdit() {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== item.raw_text) onRename(item.id, trimmed);
    setEditing(false);
  }

  function handleEditKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
    if (e.key === 'Escape') setEditing(false);
  }

  const isCarted    = item.status === 'carted';
  const isPurchased = item.status === 'purchased';
  const isLocked    = isCarted || isPurchased;
  const qty         = item.quantity ?? 1;
  const imageUrl    = item.preference?.image_url ?? null;
  const searchQuery = encodeURIComponent(item.normalized_text || item.raw_text);

  const mappingDiffers =
    item.preference &&
    item.preference.display_name.trim().toLowerCase() !== item.raw_text.trim().toLowerCase();

  // Quantity step: decrease
  function decQty() {
    const next = Math.max(1, qty - 1);
    onQuantityChange(item.id, next);
  }

  return (
    <div
      className="group relative flex items-center gap-3 px-4 py-3 hover:bg-[rgba(15,82,56,0.025)] rounded-xl border border-transparent hover:border-[#edeeef] transition-all duration-150 animate-fade-in overflow-hidden"
      style={{
        animationDelay: `${index * 40}ms`,
        borderLeftWidth: item.persistent ? 3 : 0,
        borderLeftColor: item.persistent ? '#0f5238' : 'transparent',
        borderLeftStyle: 'solid',
        paddingLeft: item.persistent ? '13px' : '16px',
        opacity: skipped ? 0.4 : 1,
        transition: 'opacity 0.15s ease, border-color 0.15s ease',
      }}
    >
      {/* ── Checkbox ── */}
      <input
        type="checkbox"
        checked={isPurchased ? true : selected}
        disabled={isLocked || skipped}
        onChange={() => !isLocked && !skipped && onToggle(item.id)}
        className="w-5 h-5 rounded flex-shrink-0 cursor-pointer disabled:cursor-default accent-[#0f5238]"
        style={{ opacity: isLocked || skipped ? 0.45 : 1 }}
        aria-label={`Select ${item.raw_text}`}
      />

      {/* ── Thumbnail ── */}
      <div
        className="w-14 h-14 flex-shrink-0 rounded-xl bg-surface-container-low overflow-hidden flex items-center justify-center text-xl border border-[#edeeef]"
        style={{ opacity: isLocked ? 0.45 : 1 }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <span>{deptEmoji(item.department)}</span>
        )}
      </div>

      {/* ── Text block ── */}
      <div className="flex-1 min-w-0 relative">
        {/* Name row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {editing ? (
            <input
              ref={editRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={handleEditKey}
              autoFocus
              className="font-semibold text-sm text-on-surface bg-surface-container-low border border-primary/40 rounded-md px-2 py-0.5 outline-none w-full max-w-xs focus:ring-2 focus:ring-primary/20"
            />
          ) : (
            <span
              onDoubleClick={startEdit}
              title={isLocked ? undefined : 'Double-click to edit'}
              className="font-semibold text-sm text-on-surface truncate max-w-[220px] sm:max-w-xs"
              style={{
                textDecoration: isLocked ? 'line-through' : 'none',
                opacity: isLocked ? 0.5 : 1,
                cursor: isLocked ? 'default' : 'text',
              }}
            >
              {item.raw_text}
            </span>
          )}

          {/* Status dots */}
          {isCarted && (
            <span className="inline-block w-2 h-2 rounded-full bg-[#22c55e] flex-shrink-0 shadow-[0_0_4px_rgba(34,197,94,0.5)]" title="In cart" />
          )}
          {isPurchased && (
            <span className="inline-block w-2 h-2 rounded-full bg-outline flex-shrink-0" title="Purchased" />
          )}

          {/* Todoist badge */}
          {!isLocked && item.source === 'todoist' && (
            <span className="text-[10px] font-semibold text-kroger bg-kroger/10 rounded px-1.5 py-0.5 flex-shrink-0 tracking-wide">
              Todoist
            </span>
          )}
        </div>

        {/* Mapping sub-line */}
        {mappingDiffers && (
          <a
            href={`/search?itemId=${item.id}&q=${searchQuery}`}
            className="block mt-0.5 text-[11px] text-outline truncate hover:text-primary transition-colors no-underline"
          >
            {item.preference!.display_name} ✏️
          </a>
        )}

        {/* ── Right action zone (overlay over text) ── */}
        <div
          className="absolute right-0 top-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity duration-150 z-10"
          style={{ transform: 'translateY(-50%)' }}
        >
          {/* Gradient mask so buttons don't overlap text harshly */}
          <div className="absolute -left-8 top-0 bottom-0 w-8 bg-gradient-to-r from-transparent to-white group-hover:to-[#f9fdf9] pointer-events-none" />
          <div className="flex items-center gap-1 bg-white group-hover:bg-[#f9fdf9] pl-1 rounded-lg relative">
            {/* Pinned + active → skip this trip */}
            {item.persistent && !isLocked && !skipped && (
              <button
                onClick={() => onSkip(item.id)}
                title="Skip this trip"
                className="flex items-center text-[10px] font-medium text-outline hover:text-on-surface border border-[#bfc9c1]/60 rounded-lg px-2 py-1 transition-colors cursor-pointer bg-transparent"
                aria-label="Skip item this trip"
              >
                Skip
              </button>
            )}

            {/* Pinned + skipped → restore + unpin */}
            {item.persistent && !isLocked && skipped && (
              <>
                <button
                  onClick={() => onSkip(item.id)}
                  title="Include this trip"
                  className="flex items-center text-[10px] font-semibold text-secondary border border-secondary/30 bg-secondary-container/30 rounded-lg px-2 py-1 transition-colors cursor-pointer"
                  aria-label="Restore item"
                >
                  <span className="material-symbols-outlined mr-0.5" style={{ fontSize: '12px' }}>undo</span>
                  Restore
                </button>
                <button
                  onClick={() => onTogglePersistent(item.id)}
                  title="Remove from staples"
                  className="flex items-center text-[10px] text-outline border border-[#bfc9c1]/60 rounded-lg px-1.5 py-1 transition-colors cursor-pointer bg-transparent"
                  aria-label="Unpin item"
                >
                  Unpin
                </button>
              </>
            )}

            {/* Not pinned + active → pin it */}
            {!item.persistent && !isLocked && (
              <button
                onClick={() => onTogglePersistent(item.id)}
                title="Pin — keeps through Clear All"
                className="flex items-center text-[10px] text-outline hover:text-primary border border-[#bfc9c1]/60 rounded-lg px-1.5 py-1 transition-colors cursor-pointer bg-transparent"
                aria-label="Pin item"
              >
                <span className="material-symbols-outlined mr-0.5" style={{ fontSize: '12px' }}>push_pin</span>
              </button>
            )}

            {/* Remove */}
            {!isLocked && (
              <button
                onClick={() => onRemove(item.id)}
                aria-label="Remove item"
                className="flex w-7 h-7 items-center justify-center rounded-lg text-outline hover:text-error hover:bg-error-container/30 transition-colors cursor-pointer bg-transparent border-none"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
              </button>
            )}

            {/* Carted → Re-search */}
            {isCarted && onSearch && (
              <button
                onClick={() => onSearch(item.id, item.raw_text)}
                title="Search again for this item"
                className="flex items-center text-[10px] font-semibold text-primary border border-primary/30 bg-primary-container/30 rounded-lg px-2 py-1 transition-colors cursor-pointer"
                aria-label="Re-search item"
              >
                <span className="material-symbols-outlined mr-0.5" style={{ fontSize: '12px' }}>search</span>
                Re-search
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Quantity pill (always visible per design spec) ── */}
      {!isLocked && (
        <div className="flex items-center bg-surface-container rounded-full border border-[#bfc9c1]/60 flex-shrink-0 relative z-20">
          <button
            onClick={decQty}
            aria-label="Decrease quantity"
            className="w-7 h-7 flex items-center justify-center text-outline hover:text-primary transition-colors rounded-full"
            disabled={qty <= 1}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>remove</span>
          </button>
          <span className="w-6 text-center text-xs font-bold text-on-surface select-none">{qty}</span>
          <button
            onClick={() => onQuantityChange(item.id, qty + 1)}
            aria-label="Increase quantity"
            className="w-7 h-7 flex items-center justify-center text-outline hover:text-primary transition-colors rounded-full"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span>
          </button>
        </div>
      )}

      {/* Locked qty badge */}
      {isLocked && qty > 1 && (
        <span className="text-[11px] font-bold text-outline bg-surface-container rounded-full px-2 py-0.5 flex-shrink-0 relative z-20">
          ×{qty}
        </span>
      )}
    </div>
  );
}
