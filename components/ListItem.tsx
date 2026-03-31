'use client';

interface ListItemData {
  id: string;
  raw_text: string;
  source: 'manual' | 'todoist';
  status: string;
  quantity?: number | null;
}

interface ListItemProps {
  item: ListItemData;
  index: number;
  onRemove: (id: string) => void;
  selected: boolean;
  onToggle: (id: string) => void;
}

export function ListItem({ item, index, onRemove, selected, onToggle }: ListItemProps) {
  const isCarted = item.status === 'carted' || item.status === 'purchased';
  return (
    <div
      className="list-item animate-fade-in"
      style={{ animationDelay: `${index * 50}ms`, display: 'flex', alignItems: 'center', gap: '12px' }}
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={isCarted ? true : selected}
        disabled={isCarted}
        onChange={() => !isCarted && onToggle(item.id)}
        style={{
          width: 18,
          height: 18,
          flexShrink: 0,
          accentColor: isCarted ? '#22c55e' : '#84cc16',
          cursor: isCarted ? 'default' : 'pointer',
          opacity: isCarted ? 0.5 : 1,
        }}
      />

      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: '1.05rem',
              letterSpacing: '-0.01em',
              textDecoration: isCarted ? 'line-through' : 'none',
              opacity: isCarted ? 0.5 : 1,
            }}
          >
            {item.raw_text}
          </div>
          {item.quantity && item.quantity > 1 && (
            <span className="badge badge-blue" style={{ fontSize: '0.75rem' }}>
              ×{item.quantity}
            </span>
          )}
          {isCarted && (
            <span
              className="badge"
              style={{ fontSize: '0.75rem', backgroundColor: 'rgba(34, 197, 94, 0.2)', color: '#22c55e' }}
            >
              ✅ In Cart
            </span>
          )}
        </div>
        {!isCarted && item.source === 'todoist' && (
          <span className="badge badge-blue" style={{ marginTop: 4, fontSize: '0.7rem' }}>
            from Todoist
          </span>
        )}
      </div>

      <button
        className="btn btn-secondary btn-icon"
        style={{ fontSize: '0.9rem', width: 32, height: 32, flexShrink: 0 }}
        onClick={() => onRemove(item.id)}
        aria-label="Remove item"
      >
        ✕
      </button>
    </div>
  );
}
