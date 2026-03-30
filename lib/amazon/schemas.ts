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
 * SerpApi price object — can have either `value` (numeric) or `raw` (string like "$12.99").
 * Falls back from value → raw → 0.
 */
export const SerpApiPriceSchema = z
  .object({
    value: z.number().positive().optional().catch(undefined),
    raw: z.string().optional().catch(undefined),
    currency: z.string().optional().catch(undefined),
  })
  .transform((p) => {
    const value = p.value ?? (p.raw ? parseRawPrice(p.raw) : 0);
    return { value, currency: p.currency ?? 'USD' };
  });

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

export const SerpApiResponseSchema = z.object({
  organic_results: z.array(z.unknown()).optional().catch([]),
  error: z.string().optional(),
});

// ─── Inferred types ───────────────────────────────────────────

export type SerpApiAmazonResult = z.infer<typeof SerpApiAmazonResultSchema>;
