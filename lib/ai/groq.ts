import Groq from 'groq-sdk';
import { ProductMatch } from '@/types';

// ---------------------------------------------------------------------------
// Groq AI Semantic Match Evaluator
// Uses Llama 3.1 70B to pick the best product match from a candidate list.
// Understands grocery semantics, generic/store-brand equivalence, and
// common abbreviations. "Never return nothing" — if something remotely
// matches, it gets selected so the compare page is rarely empty.
// ---------------------------------------------------------------------------

const MODEL = 'llama-3.1-70b-versatile';
const CONFIDENCE_THRESHOLD = 80;
const TIMEOUT_MS = 8_000;

export interface SemanticMatchResult {
  bestMatchId: string;
  confidenceScore: number;
  reasoning: string;
  totalQty?: number;      // Extracted total quantity in base unit (oz for weight, fl oz for volume, count for packs)
  totalQtyUnit?: string;  // Unit for totalQty: 'oz', 'fl oz', or 'ct'
}

function getClient(): Groq | null {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  return new Groq({ apiKey });
}

/**
 * Send the user's search query and a list of candidate products to the LLM.
 * The LLM picks the single best match, returns a confidence score & reasoning.
 *
 * Returns `null` on any failure so the caller can fall back to fuzzy scoring.
 */
export async function evaluateSemanticMatch(
  query: string,
  candidates: ProductMatch[],
): Promise<SemanticMatchResult | null> {
  const client = getClient();
  if (!client || candidates.length === 0) return null;

  const top = candidates.slice(0, 10);
  const productList = top
    .map(
      (p, i) =>
        `${i + 1}. [id=${p.id}] "${p.name}" | Brand: ${p.brand} | Size: ${p.size} | Dept: ${p.department ?? 'unknown'} | $${p.price}`,
    )
    .join('\n');

  const systemPrompt = `You are a grocery expert. Match the user's intent: '${query}' to the best available product in this list.

Generic Brand Awareness: Recognize that 'Great Value' (Walmart), 'Simple Truth'/'Kroger' (King Soopers), and '365' (Whole Foods/Amazon) are equivalent generic store brands. Prioritize store-brand-to-store-brand matches for staples like milk, eggs, bread, and butter.

Product Semantics: 'milk' means dairy milk (not milk chocolate). '2% milk' matches '2% Reduced Fat Milk'. 'tp' means toilet paper. 'oj' means orange juice.

Never Return Nothing: Unless the results are completely unrelated (e.g., searching for milk and getting a toaster), ALWAYS pick the most similar item. A low-confidence match is better than no match.

Size Extraction: For the best match, extract its total quantity:
- If it is a multi-pack (e.g., "6 x 16.9 fl oz", "12 mega rolls"), compute the TOTAL quantity.
- For weight/volume, normalize to oz (for solids) or fl oz (for liquids).
- For count items (rolls, sheets, packs), use the total count.

Output: Return a JSON object with exactly these fields:
- "bestMatchId": the id of the best matching product (copy the exact id string)
- "confidenceScore": a number 0-100
- "reasoning": a short explanation (e.g., "Matched generic 2% milk to store-brand 2% milk")
- "totalQty": the total normalized quantity of the best match as a number (null if not determinable)
- "totalQtyUnit": the unit for totalQty — one of "oz", "fl oz", or "ct" (null if not determinable)`;

  const userPrompt = `Search query: "${query}"

Available products:
${productList}`;

  try {
    const response = await Promise.race([
      client.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 200,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Groq timeout')), TIMEOUT_MS),
      ),
    ]);

    const raw = response.choices[0]?.message?.content;
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'bestMatchId' in parsed &&
      'confidenceScore' in parsed &&
      'reasoning' in parsed
    ) {
      const obj = parsed as Record<string, unknown>;
      const bestMatchId = String(obj.bestMatchId);
      const confidenceScore = Math.max(0, Math.min(100, Math.round(Number(obj.confidenceScore))));
      const reasoning = String(obj.reasoning).slice(0, 250);

      // Validate the returned id actually exists in candidates
      const exists = top.some((p) => p.id === bestMatchId);
      if (!exists) {
        console.warn(`[groq] Returned bestMatchId "${bestMatchId}" not found in candidates — ignoring`);
        return null;
      }

      // Extract optional size fields
      const rawQty = obj.totalQty;
      const rawUnit = obj.totalQtyUnit;
      const totalQty =
        rawQty != null && rawQty !== 'null' && !isNaN(Number(rawQty))
          ? Math.round(Number(rawQty) * 100) / 100
          : undefined;
      const totalQtyUnit =
        rawUnit != null && rawUnit !== 'null' && typeof rawUnit === 'string'
          ? String(rawUnit).toLowerCase()
          : undefined;

      return { bestMatchId, confidenceScore, reasoning, totalQty, totalQtyUnit };
    }
    return null;
  } catch (err) {
    console.warn('[groq] evaluateSemanticMatch failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Apply AI semantic matching to a set of scored products.
 *
 * Strategy:
 * - If the top fuzzy match scores >= 80, it's confident enough — skip AI.
 * - Otherwise, send candidates to Groq to pick the best semantic match.
 * - The AI-chosen product gets promoted to position 0 with the AI's confidence
 *   score and reasoning attached.
 * - If GROQ_API_KEY is not set or AI fails, returns products unchanged.
 */
export async function applySemanticMatching(
  query: string,
  products: ProductMatch[],
): Promise<ProductMatch[]> {
  if (!process.env.GROQ_API_KEY || products.length === 0) return products;

  const topScore = products[0]?.match_score ?? 0;
  if (topScore >= CONFIDENCE_THRESHOLD) return products;

  console.log(
    `[groq] Top fuzzy score for "${query}" is ${topScore} — invoking semantic matching on ${products.length} candidate(s)`,
  );

  const result = await evaluateSemanticMatch(query, products);
  if (!result) return products;

  console.log(
    `[groq] Semantic match for "${query}": picked "${result.bestMatchId}" with confidence ${result.confidenceScore} — ${result.reasoning}`,
  );

  const aiIdx = products.findIndex((p) => p.id === result.bestMatchId);
  if (aiIdx === -1) return products;

  const updated = [...products];
  const chosen = {
    ...updated[aiIdx],
    match_score: result.confidenceScore,
    ai_reasoning: result.reasoning,
    ...(result.totalQty !== undefined ? { normalized_total_qty: result.totalQty } : {}),
    ...(result.totalQtyUnit !== undefined ? { normalized_qty_unit: result.totalQtyUnit } : {}),
  };

  // Remove from original position and insert at front
  updated.splice(aiIdx, 1);
  updated.unshift(chosen);

  return updated;
}
