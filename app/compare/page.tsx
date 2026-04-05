// Server component — owns the Suspense boundary so Next.js emits proper
// streaming markers (<!--$-->) in the HTML. Moving the boundary here (vs.
// inside a 'use client' file) prevents the hydration mismatch where the
// server renders the fallback div without markers but the client expects
// a <Suspense> node at that position.
import { Suspense } from 'react';
import ComparePageInner, { CompareLoadingScreen } from './ComparePageInner';

export default function ComparePage() {
  return (
    <Suspense fallback={<CompareLoadingScreen includeAmazon={true} />}>
      <ComparePageInner />
    </Suspense>
  );
}
