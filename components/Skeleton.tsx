/**
 * Reusable shimmer skeleton primitives.
 * Import and compose these to build page-specific loading states.
 */

const shimmerStyle: React.CSSProperties = {
  background: 'linear-gradient(90deg, var(--bg-card, #1a1a1a) 25%, var(--border-subtle, #2a2a2a) 50%, var(--bg-card, #1a1a1a) 75%)',
  backgroundSize: '200% 100%',
  animation: 'skeleton-shimmer 1.5s infinite',
  borderRadius: '6px',
};

export function SkeletonLine({
  width = '100%',
  height = '1rem',
  style,
}: {
  width?: string | number;
  height?: string | number;
  style?: React.CSSProperties;
}) {
  return <div style={{ ...shimmerStyle, width, height, ...style }} />;
}

export function SkeletonCard({ height = '120px' }: { height?: string }) {
  return (
    <div
      style={{
        ...shimmerStyle,
        height,
        borderRadius: '12px',
        width: '100%',
      }}
    />
  );
}

export function SkeletonGrid({
  columns = 2,
  rows = 3,
  cardHeight = '120px',
  gap = '1rem',
}: {
  columns?: number;
  rows?: number;
  cardHeight?: string;
  gap?: string;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap,
      }}
    >
      {Array.from({ length: columns * rows }).map((_, i) => (
        <SkeletonCard key={i} height={cardHeight} />
      ))}
    </div>
  );
}

export function SkeletonRow({ cols = 4, gap = '1rem' }: { cols?: number; gap?: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap, alignItems: 'center' }}>
      {Array.from({ length: cols }).map((_, i) => (
        <SkeletonLine key={i} height="1.2rem" />
      ))}
    </div>
  );
}
