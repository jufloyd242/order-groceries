import { SkeletonLine, SkeletonGrid } from '@/components/Skeleton';

export default function SearchLoading() {
  return (
    <div className="container" style={{ paddingBottom: '200px' }}>
      {/* Header */}
      <div style={{ paddingTop: '2rem', marginBottom: '2rem' }}>
        <SkeletonLine width="180px" height="2rem" style={{ marginBottom: '1rem' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem' }}>
          <SkeletonLine height="2.75rem" style={{ borderRadius: '8px' }} />
          <SkeletonLine width="100px" height="2.75rem" style={{ borderRadius: '8px' }} />
        </div>
      </div>

      {/* Two-column product grid skeleton */}
      <SkeletonGrid columns={2} rows={5} cardHeight="140px" gap="1rem" />
    </div>
  );
}
