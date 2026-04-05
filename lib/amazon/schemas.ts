import { z } from 'zod';

// ─── Price parsing helper ─────────────────────────────────────

/**
 * Parse a raw price string like "$12.99" or "12.99" into a number.
 * Returns 0 if parsing fails.
 */
function parseRawPrice(raw: string): number {
  const match = raw.replace(/[^0-9.]/g, '');
  const value = parseFloat(match);
  return isFinite(value) && value > 0 ? value : 0;
}

// ─── Price schema ─────────────────────────────────────────────

/**
 * SerpApi price — handles all three shapes the API returns:
 *   - Plain string:  "$5.79"          → coerced to { raw: "$5.79" }
 *   - Plain number:  5.79             → coerced to { value: 5.79 }
 *   - Object:        { value, raw, …} → passed through unchanged
 *
 * The preprocess step runs before Zod's object validation so no shape
 * is ever silently dropped by .catch(undefined).
 */
export const SerpApiPriceSchema = z.preprocess(
  (input) => {
    if (typeof input === 'string') return { raw: input };
    if (typeof input === 'number') return { value: input };
    return input;
  },
  z
    .object({
      value: z.number().positive().optional().catch(undefined),
      extracted_value: z.number().positive().optional().catch(undefined),
      raw: z.string().optional().catch(undefined),
      currency: z.string().optional().catch(undefined),
    })
    .transform((p) => {
      const value = p.value ?? p.extracted_value ?? (p.raw ? parseRawPrice(p.raw) : 0);
      return { value, currency: p.currency ?? 'USD' };
    })
);

// ─── Amazon product schema ────────────────────────────────────

export const SerpApiAmazonResultSchema = z.object({
  position: z.number().catch(0),
  title: z.string().catch(''),
  asin: z.string().catch(''),
  link: z.string().catch(''),
  price: SerpApiPriceSchema.optional().catch(undefined),
  rating: z.number().optional().catch(undefined),
  ratings_total: z.number().optional().catch(undefined),
  is_prime: z.boolean().optional().catch(undefined),
  thumbnail: z.string().url().optional().catch(undefined),
  delivery: z.string().optional().catch(undefined),
});

// ─── Response schema ──────────────────────────────────────────

// .passthrough() keeps any extra top-level SerpApi fields (search_metadata, etc.)
// so the parse never fails due to unexpected response shape.
export const SerpApiResponseSchema = z.object({
  organic_results: z.array(z.unknown()).optional().catch([]),
  error: z.string().optional(),
}).passthrough();

// ─── Inferred types ───────────────────────────────────────────

export type SerpApiAmazonResult = z.infer<typeof SerpApiAmazonResultSchema>;

// ─── Product page schema (engine: 'amazon_product') ──────────
//
// The amazon_product engine returns a `product_results` object rather than
// an organic_results array. Fields differ slightly from the search response.

export const SerpApiProductResultSchema = z.object({
  title: z.string().catch(''),
  asin: z.string().catch(''),
  // Product page link (not always present)
  link: z.string().optional().catch(undefined),
  // Price may be nested under `price` or `pricing[0]`
  price: SerpApiPriceSchema.optional().catch(undefined),
  // First image from the images array, fallback to top-level thumbnail
  thumbnail: z.string().url().optional().catch(undefined),
  brand: z.string().optional().catch(undefined),
  rating: z.number().optional().catch(undefined),
  ratings_total: z.number().optional().catch(undefined),
  // Feature bullets — join to form a description if needed
  feature_bullets: z.array(z.string()).optional().catch(undefined),
});

export const SerpApiProductPageSchema = z.object({
  product_results: SerpApiProductResultSchema.optional().catch(undefined),
  error: z.string().optional(),
}).passthrough();

export type SerpApiProductResult = z.infer<typeof SerpApiProductResultSchema>;
