'use client';

export interface ListItemData {
  id: string;
  raw_text: string;
  normalized_text?: string | null;
  source: 'manual' | 'todoist';
  status: string;
  quantity?: number | null;
  persistent?: boolean;
  department?: string | null;
  preference?: { display_name: string; preferred_upc?: string | null; preferred_asin?: string | null } | null;
}

interface ListItemProps {
  item: ListItemData;
  index: number;
  onRemove: (id: string) => void;
  selected: boolean;
  onToggle: (id: string) => void;
  onTogglePersistent: (id: string) => void;
  onQuantityChange: (id: string, qty: number) => void;
}

export function ListItem({ item, index, onRemove, selected, onToggle, onTogglePersistent, onQuantityChange }: ListItemProps) {
  const isCarted = item.status === 'carted';
  const isPurchased = item.status === 'purchased';
  const isLocked = isCarted || isPurchased;

  const searchQuery = encodeURIComponent(item.normalized_text || item.raw_text);

  return (
    <div
      className="list-item animate-fade-in"
      style={{ animationDelay: `${index * 50}ms`, display: 'flex', alignItems: 'center', gap: '12px' }}
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={isLocked ? true : selected}
        disabled={isLocked}
        onChange={() => !isLocked && onToggle(item.id)}
        style={{
          width: 18,
          height: 18,
          flexShrink: 0,
          accentColor: isLocked ? '#22c55e' : '#84cc16',
          cursor: isLocked ? 'default' : 'pointer',
          opacity: isLocked ? 0.5 : 1,
        }}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Item name row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: '1.05rem',
              letterSpacing: '-0.01em',
              textDecoration: isLocked ? 'line-through' : 'none',
              opacity: isLocked ? 0.5 : 1,
            }}
          >
            {item.raw_text}
          </div>
            {/* Quantity stepper (non-locked) or read-only badge (locked) */}
            {!isLocked ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                <button
                  onClick={() => onQuantityChange(item.id, Math.max(1, (item.quantity ?? 1) - 1))}
                  disabled={(item.quantity ?? 1) <= 1}
                  aria-label="Decrease quantity"
                  style={{
                    background: 'none',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '4px',
                    color: (item.quantity ?? 1) <= 1 ? '#334155' : 'var(--text-secondary)',
                    fontSize: '0.8rem',
                    cursor: (item.quantity ?? 1) <= 1 ? 'default' : 'pointer',
                    width: 22,
                    height: 22,
                    lineHeight: 1,
                    padding: 0,
                    flexShrink: 0,
                  }}
                >
                  −
                </button>
                <span style={{ minWidth: 18, textAlign: 'center', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {item.quantity ?? 1}
                </span>
                <button
                  onClick={() => onQuantityChange(item.id, (item.quantity ?? 1) + 1)}
                  aria-label="Increase quantity"
                  style={{
                    background: 'none',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '4px',
                    color: 'var(--text-secondary)',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    width: 22,
                    height: 22,
                    lineHeight: 1,
                    padding: 0,
                    flexShrink: 0,
                  }}
                >
                  +
                </button>
              </div>
            ) : (
              item.quantity && item.quantity > 1 && (
                <span className="badge badge-blue" style={{ fontSize: '0.75rem' }}>
                  ×{item.quantity}
                </span>
              )
            )}
            {isCarted && (
              <span className="badge" style={{ fontSize: '0.75rem', backgroundColor: 'rgba(34, 197, 94, 0.2)', color: '#22c55e' }}>
                ✅ In Cart
              </span>
            )}
            {isPurchased && (
              <span className="badge" style={{ fontSize: '0.75rem', backgroundColor: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8' }}>
                Purchased
              </span>
            )}
        </div>

        {/* Sub-caption: preference mapping (all items) + Todoist badge (active only) */}
        {(item.preference || (!isLocked && item.source === 'todoist')) && (
          <div style={{ marginTop: 3, display: 'flex', alignItems: 'center', gap: '6px' }}>
            {item.preference && (
              <>
                <span style={{ fontSize: '0.72rem', color: '#4ade80', opacity: 0.85 }}>
                  Mapped to: {item.preference.display_name}
                </span>
                {!isLocked && (
                  <a
                    href={`/search?itemId=${item.id}&q=${searchQuery}`}
                    title="Update preference"
                    style={{ fontSize: '0.68rem', color: '#84cc16', textDecoration: 'none', lineHeight: 1 }}
                  >
                    ✏️
                  </a>
                )}
              </>
            )}
            {!isLocked && item.source === 'todoist' && (
              <span className="badge badge-blue" style={{ fontSize: '0.68rem' }}>
                Todoist
              </span>
            )}
          </div>
        )}
      </div>

      {/* Persistent pin toggle — available for all statuses */}
      <button
        onClick={() => onTogglePersistent(item.id)}
        title={item.persistent ? 'Pinned — survives Clear All (click to unpin)' : 'Pin to keep through Clear All'}
        style={{
          background: item.persistent ? 'rgba(132, 204, 22, 0.12)' : 'none',
          border: item.persistent ? '1px solid rgba(132, 204, 22, 0.35)' : '1px solid transparent',
          borderRadius: '6px',
          color: item.persistent ? '#84cc16' : '#475569',
          fontSize: '0.85rem',
          cursor: 'pointer',
          padding: '3px 6px',
          flexShrink: 0,
          lineHeight: 1,
          transition: 'all 0.15s',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          marginRight: '4px',
        }}
        aria-label={item.persistent ? 'Unpin item' : 'Pin item'}
      >
        {item.persistent ? '📌 Pinned' : '📌'}
      </button>

      {/* Remove button */}
      {!isLocked && (
        <button
          className="btn btn-secondary btn-icon"
          style={{ fontSize: '0.9rem', width: 32, height: 32, flexShrink: 0 }}
          onClick={() => onRemove(item.id)}
          aria-label="Remove item"
        >
          ✕
        </button>
      )}
    </div>
  );
}
