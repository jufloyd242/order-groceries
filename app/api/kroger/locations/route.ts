import { NextRequest, NextResponse } from 'next/server';
import { searchLocations } from '@/lib/kroger/products';

/**
 * GET /api/kroger/locations?zip=80516&chain=King+Soopers
 *
 * Proxies store location searches to the Kroger API.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const zip = searchParams.get('zip') || process.env.DEFAULT_ZIP_CODE || '80516';
    const chain = searchParams.get('chain') || process.env.DEFAULT_STORE_CHAIN || 'King Soopers';

    const locations = await searchLocations(zip, chain);

    return NextResponse.json({
      success: true,
      zip,
      chain,
      count: locations.length,
      locations,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Kroger location search error:', message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
