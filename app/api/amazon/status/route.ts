import { NextRequest, NextResponse } from 'next/server';
import { createRequestClient } from '@/lib/supabase/server';

/**
 * GET /api/amazon/status
 * Returns whether SerpApi is configured (without exposing the key).
 */
export async function GET(request: NextRequest) {
  const { user } = await createRequestClient(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return NextResponse.json({
    configured: Boolean(process.env.SERPAPI_API_KEY),
  });
}
