import { NextRequest, NextResponse } from 'next/server';
import { searchAmazonProducts } from '@/lib/amazon/products';

/**
 * GET /api/amazon/products?q=toilet+paper&zip=80516
 *
 * Proxies Amazon product searches to SerpApi.
 * Keeps the SerpApi key server-side.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const zip = searchParams.get('zip') || process.env.DEFAULT_ZIP_CODE || '80516';

    if (!query) {
      return NextResponse.json(
        { error: 'Missing required parameter: q' },
        { status: 400 }
      );
    }

    const products = await searchAmazonProducts(query, zip);

    return NextResponse.json({
      success: true,
      query,
      zip,
      count: products.length,
      products,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Amazon product search error:', message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
