'use client';

// Same signature as ListItemData in page.tsx
interface ListItemData {
  id: string;
  raw_text: string;
  source: 'manual' | 'todoist';
  status: string;
  preference_match?: string | null;
  quantity?: number | null;
}

interface ListItemProps {
  item: ListItemData;
  index: number;
  matchName: string | null;
  onRemove: (id: string) => void;
}

export function ListItem({ item, index, matchName, onRemove }: ListItemProps) {
  return (
    <div
      className="list-item animate-fade-in"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ fontWeight: 600, fontSize: '1.05rem', letterSpacing: '-0.01em' }}>
            {item.raw_text}
          </div>
          {item.quantity && item.quantity > 1 && (
            <span className="badge badge-blue" style={{ fontSize: '0.75rem' }}>
              ×{item.quantity}
            </span>
          )}
          {item.status === 'purchased' && (
            <span className="badge" style={{ fontSize: '0.75rem', backgroundColor: 'rgba(34, 197, 94, 0.2)', color: '#22c55e' }}>
              ✅ In cart
            </span>
          )}
        </div>
        {item.status === 'purchased' ? (
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 2 }}>
            Added to cart
          </div>
        ) : matchName ? (
          <div style={{ fontSize: '0.85rem', color: 'var(--accent-green)', marginTop: 2 }}>
            → {matchName}
          </div>
        ) : (
          <div style={{ fontSize: '0.85rem', color: 'var(--accent-amber)', marginTop: 2 }}>
            ⚠️ new — needs product pick
          </div>
        )}
        {item.source === 'todoist' && item.status !== 'purchased' && (
          <span
            className="badge badge-blue"
            style={{ marginTop: 4, fontSize: '0.7rem' }}
          >
            from Todoist
          </span>
        )}
      </div>
      <button
        className="btn btn-secondary btn-icon"
        style={{ fontSize: '0.9rem', width: 32, height: 32 }}
        onClick={() => onRemove(item.id)}
        aria-label="Remove item"
      >
        ✕
      </button>
    </div>
  );
}
