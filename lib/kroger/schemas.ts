import { z } from 'zod';

// ─── Price sub-schemas ────────────────────────────────────────

const PriceValueSchema = z.object({
  regular: z.number().nonnegative().catch(0),
  promo: z.number().nonnegative().catch(0),
});

const FulfillmentOptionSchema = z.object({
  price: z.number().nonnegative().catch(0),
  promo: z.number().nonnegative().optional().catch(undefined),
});

// ─── Item schema ──────────────────────────────────────────────

export const KrogerItemSchema = z.object({
  size: z.string().catch(''),
  price: PriceValueSchema.optional().catch(undefined),
  nationalPrice: PriceValueSchema.optional().catch(undefined),
  fulfillment: z
    .object({
      curbside: FulfillmentOptionSchema.optional().catch(undefined),
      fip: FulfillmentOptionSchema.optional().catch(undefined),
      inStore: FulfillmentOptionSchema.optional().catch(undefined),
    })
    .optional()
    .catch(undefined),
});

// ─── Image schema ─────────────────────────────────────────────

const KrogerImageSizeSchema = z.object({
  size: z.string(),
  url: z.string().url().catch(''),
});

const KrogerImageSchema = z.object({
  perspective: z.string(),
  sizes: z.array(KrogerImageSizeSchema).catch([]),
});

// ─── Product schema ───────────────────────────────────────────

export const KrogerProductSchema = z.object({
  productId: z.string(),
  upc: z.string().catch(''),
  description: z.string().catch('Unknown Product'),
  brand: z.string().catch(''),
  items: z.array(KrogerItemSchema).catch([]),
  images: z.array(KrogerImageSchema).catch([]),
});

// ─── Search response schema ───────────────────────────────────

export const KrogerSearchResponseSchema = z.object({
  data: z.array(z.unknown()).catch([]),
  meta: z
    .object({
      pagination: z
        .object({ start: z.number(), limit: z.number(), total: z.number() })
        .optional(),
    })
    .optional(),
});

// ─── Inferred types ───────────────────────────────────────────

export type KrogerItem = z.infer<typeof KrogerItemSchema>;
export type KrogerProduct = z.infer<typeof KrogerProductSchema>;

// ─── Price extraction helper ──────────────────────────────────

/**
 * Extract the best available price from a Kroger item.
 * Priority: item.price.regular → item.nationalPrice.regular → fulfillment (curbside|inStore|fip)
 * Returns { price, promoPrice } — price is 0 if unavailable at this location.
 */
export function extractKrogerPrice(item: KrogerItem | undefined): {
  price: number;
  promoPrice: number | null;
} {
  if (!item) return { price: 0, promoPrice: null };

  let price = item.price?.regular ?? item.nationalPrice?.regular ?? 0;
  let promoPrice = item.price?.promo ?? item.nationalPrice?.promo ?? null;

  // Normalize promo: 0 is not a real promo price
  if (promoPrice === 0) promoPrice = null;

  // If still 0, fall back to fulfillment pricing
  if (price === 0 && item.fulfillment) {
    const f = item.fulfillment;
    const bestF = f.curbside ?? f.inStore ?? f.fip;
    if (bestF && bestF.price > 0) {
      price = bestF.price;
      promoPrice = bestF.promo && bestF.promo > 0 ? bestF.promo : null;
    }
  }

  // Only return promo if it's genuinely lower
  if (promoPrice !== null && promoPrice >= price) promoPrice = null;

  return { price, promoPrice };
}
