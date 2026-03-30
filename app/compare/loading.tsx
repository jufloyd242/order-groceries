import { SkeletonLine, SkeletonRow } from '@/components/Skeleton';

export default function CompareLoading() {
  return (
    <div className="container" style={{ paddingTop: '2rem', paddingBottom: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <SkeletonLine width="220px" height="2rem" />
        <SkeletonLine width="100px" height="2.5rem" />
      </div>

      {/* Summary cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}
      >
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="glass-card" style={{ padding: '1rem' }}>
            <SkeletonLine width="60%" height="0.8rem" style={{ marginBottom: '0.5rem' }} />
            <SkeletonLine width="40%" height="1.8rem" />
          </div>
        ))}
      </div>

      {/* Comparison rows */}
      <div className="glass-card" style={{ padding: '1rem', overflow: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          {/* Header row */}
          <div style={{ padding: '1rem' }}>
            <SkeletonRow cols={5} />
          </div>
          {/* Data rows */}
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              style={{
                padding: '1rem',
                borderTop: '1px solid var(--border-subtle)',
              }}
            >
              <SkeletonRow cols={5} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
