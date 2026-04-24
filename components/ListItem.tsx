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
}

// Department → emoji icon used as thumbnail fallback
const DEPT_EMOJI: Record<string, string> = {
  Produce: '🥦', Bakery: '🍞', Deli: '🧀', Meat: '🥩', Seafood: '🐟',
  Dairy: '🥛', Frozen: '🧊', Beverages: '🥤', Snacks: '🍿', Pantry: '🥫',
  Household: '🧹', 'Personal Care': '🧴', 'Pet Care': '🐾', Other: '🛒',
};

function deptIcon(dept?: string | null): string {
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
}: ListItemProps) {
  const [stepperOpen, setStepperOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const editRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    if (isLocked) return;
    setEditValue(item.raw_text);
    setEditing(true);
    // Focus after render
    setTimeout(() => editRef.current?.select(), 0);
  }

  function commitEdit() {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== item.raw_text) {
      onRename(item.id, trimmed);
    }
    setEditing(false);
  }

  function handleEditKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
    if (e.key === 'Escape') { setEditing(false); }
  }

  const isCarted = item.status === 'carted';
  const isPurchased = item.status === 'purchased';
  const isLocked = isCarted || isPurchased;
  const qty = item.quantity ?? 1;

  const searchQuery = encodeURIComponent(item.normalized_text || item.raw_text);
  const imageUrl = item.preference?.image_url ?? null;

  // Show mapping sub-line only when the mapped name differs meaningfully from raw text
  const mappingDiffers =
    item.preference &&
    item.preference.display_name.trim().toLowerCase() !== item.raw_text.trim().toLowerCase();

  return (
    // Outer wrapper provides the lime left-border accent for pinned items
    <div
      style={{
        borderLeft: item.persistent
          ? '2px solid var(--accent-green)'
          : '2px solid transparent',
        marginLeft: -14,
        paddingLeft: 12,
        borderRadius: 4,
        opacity: skipped ? 0.38 : 1,
        transition: 'opacity 0.15s ease',
      }}
    >
    <div
      className="list-item animate-fade-in"
      style={{ animationDelay: `${index * 50}ms`, display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px' }}
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={isLocked ? true : selected}
        disabled={isLocked || skipped}
        onChange={() => !isLocked && !skipped && onToggle(item.id)}
        style={{
          width: 17,
          height: 17,
          flexShrink: 0,
          accentColor: isLocked ? '#22c55e' : '#84cc16',
          cursor: isLocked || skipped ? 'default' : 'pointer',
          opacity: isLocked || skipped ? 0.45 : 1,
        }}
      />

      {/* Thumbnail: product image if available, else dept emoji */}
      <div
        style={{
          width: 40,
          height: 40,
          flexShrink: 0,
          borderRadius: 8,
          overflow: 'hidden',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.35rem',
          opacity: isLocked ? 0.4 : 1,
        }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          deptIcon(item.department)
        )}
      </div>

      {/* Text block */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Primary row: pin indicator + name + status dot */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {/* Subtle pin indicator — click to toggle */}
          {item.persistent && (
            <button
              onClick={() => onTogglePersistent(item.id)}
              title="Pinned — click to unpin"
              style={{
                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                fontSize: '0.75rem', lineHeight: 1, flexShrink: 0, opacity: 0.65,
              }}
              aria-label="Unpin item"
            >
              📌
            </button>
          )}

          {editing ? (
            <input
              ref={editRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={handleEditKey}
              autoFocus
              style={{
                fontWeight: 600,
                fontSize: '1rem',
                letterSpacing: '-0.01em',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(132,204,22,0.5)',
                borderRadius: 5,
                color: 'var(--text-primary)',
                padding: '1px 6px',
                outline: 'none',
                width: '100%',
                maxWidth: 280,
              }}
            />
          ) : (
            <span
              onDoubleClick={startEdit}
              title={isLocked ? undefined : 'Double-click to edit'}
              style={{
                fontWeight: 600,
                fontSize: '1rem',
                letterSpacing: '-0.01em',
                textDecoration: isLocked ? 'line-through' : 'none',
                opacity: isLocked ? 0.45 : 1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '100%',
                cursor: isLocked ? 'default' : 'text',
              }}
            >
              {item.raw_text}
            </span>
          )}

          {/* Status dot */}
          {isCarted && (
            <span
              title="In cart"
              style={{
                display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                backgroundColor: '#22c55e', flexShrink: 0, boxShadow: '0 0 4px rgba(34,197,94,0.6)',
              }}
            />
          )}
          {isPurchased && (
            <span
              title="Purchased"
              style={{
                display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                backgroundColor: '#475569', flexShrink: 0,
              }}
            />
          )}

          {/* Todoist source badge — compact */}
          {!isLocked && item.source === 'todoist' && (
            <span style={{
              fontSize: '0.62rem', fontWeight: 600, color: '#60a5fa',
              background: 'rgba(59,130,246,0.12)', borderRadius: 4, padding: '1px 5px',
              letterSpacing: '0.03em', flexShrink: 0,
            }}>
              Todoist
            </span>
          )}
        </div>

        {/* Secondary row: mapped product — whole line is tappable link */}
        {mappingDiffers && (
          <a
            href={`/search?itemId=${item.id}&q=${searchQuery}`}
            style={{
              display: 'block',
              marginTop: 2,
              fontSize: '0.71rem',
              color: 'var(--text-muted)',
              textDecoration: 'none',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {item.preference!.display_name} ✏️
          </a>
        )}
      </div>

      {/* Right-side controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        {/* Quantity — show badge when >1, stepper when badge tapped */}
        {!isLocked && (
          stepperOpen ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
              <button
                onClick={() => {
                  const next = Math.max(1, qty - 1);
                  onQuantityChange(item.id, next);
                  if (next === 1) setStepperOpen(false);
                }}
                aria-label="Decrease quantity"
                style={{
                  background: 'none', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 4, color: qty <= 1 ? '#334155' : 'var(--text-secondary)',
                  fontSize: '0.78rem', cursor: qty <= 1 ? 'default' : 'pointer',
                  width: 22, height: 22, padding: 0, flexShrink: 0,
                }}
              >
                −
              </button>
              <span style={{ minWidth: 18, textAlign: 'center', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {qty}
              </span>
              <button
                onClick={() => onQuantityChange(item.id, qty + 1)}
                aria-label="Increase quantity"
                style={{
                  background: 'none', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 4, color: 'var(--text-secondary)',
                  fontSize: '0.78rem', cursor: 'pointer',
                  width: 22, height: 22, padding: 0, flexShrink: 0,
                }}
              >
                +
              </button>
              <button
                onClick={() => setStepperOpen(false)}
                aria-label="Close quantity editor"
                style={{
                  background: 'none', border: 'none', color: 'var(--text-muted)',
                  fontSize: '0.7rem', cursor: 'pointer', padding: '0 2px',
                }}
              >
                ✓
              </button>
            </div>
          ) : (
            qty > 1 ? (
              <button
                onClick={() => setStepperOpen(true)}
                title="Edit quantity"
                style={{
                  background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.25)',
                  borderRadius: 6, color: '#93c5fd', fontSize: '0.75rem', fontWeight: 700,
                  cursor: 'pointer', padding: '2px 7px', flexShrink: 0,
                }}
              >
                ×{qty}
              </button>
            ) : (
              <button
                onClick={() => setStepperOpen(true)}
                title="Set quantity"
                style={{
                  background: 'none', border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 6, color: 'var(--text-muted)', fontSize: '0.7rem',
                  cursor: 'pointer', padding: '2px 6px', flexShrink: 0,
                  opacity: 0.25,
                }}
              >
                ×1
              </button>
            )
          )
        )}
        {isLocked && qty > 1 && (
          <span style={{
            background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)',
            borderRadius: 6, color: '#93c5fd', fontSize: '0.75rem', fontWeight: 700,
            padding: '2px 7px',
          }}>
            ×{qty}
          </span>
        )}

        {/* ── Right action zone ── */}

        {/* Pinned + active → ⊘ Skip this trip */}
        {item.persistent && !isLocked && !skipped && (
          <button
            onClick={() => onSkip(item.id)}
            title="Skip this trip"
            style={{
              background: 'none', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6, color: 'var(--text-muted)', fontSize: '0.7rem',
              cursor: 'pointer', padding: '3px 7px', flexShrink: 0,
            }}
            aria-label="Skip item this trip"
          >
            ⊘
          </button>
        )}

        {/* Pinned + skipped → ↺ restore + 📌 Unpin */}
        {item.persistent && !isLocked && skipped && (
          <>
            <button
              onClick={() => onSkip(item.id)}
              title="Restore — include this item again"
              style={{
                background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)',
                borderRadius: 6, color: '#34d399', fontSize: '0.75rem',
                cursor: 'pointer', padding: '3px 7px', flexShrink: 0,
              }}
              aria-label="Restore item"
            >
              ↺
            </button>
            <button
              onClick={() => onTogglePersistent(item.id)}
              title="Remove from staples permanently"
              style={{
                background: 'none', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6, color: 'var(--text-muted)', fontSize: '0.7rem',
                cursor: 'pointer', padding: '3px 6px', flexShrink: 0,
              }}
              aria-label="Unpin item"
            >
              📌 Unpin
            </button>
          </>
        )}

        {/* Not pinned + active → 📌 pin it */}
        {!item.persistent && !isLocked && (
          <button
            onClick={() => onTogglePersistent(item.id)}
            title="Pin — keeps through Clear All"
            style={{
              background: 'none', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 6, color: 'var(--text-muted)', fontSize: '0.72rem',
              cursor: 'pointer', padding: '3px 6px', flexShrink: 0,
            }}
            aria-label="Pin item"
          >
            📌
          </button>
        )}

        {/* Remove */}
        {!isLocked && (
          <button
            className="btn btn-secondary btn-icon"
            style={{ fontSize: '0.85rem', width: 28, height: 28, flexShrink: 0, opacity: 0.7 }}
            onClick={() => onRemove(item.id)}
            aria-label="Remove item"
          >
            ✕
          </button>
        )}
      </div>
    </div>
    </div>
  );
}
