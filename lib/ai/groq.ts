import Groq from 'groq-sdk';
import { ProductMatch } from '@/types';
import { createClient } from '@/lib/supabase/server';

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

Measurement vs Count Awareness:
- If the search query includes a measurement (e.g., "1/2 cup milk", "500g chicken", "2 tbsp butter"), the user needs a specific amount. Pick the SMALLEST available package that provides AT LEAST that amount. Do NOT pick bulk/warehouse sizes.
- If the query is a count (e.g., "3 apples", "2 bananas"), pick the most relevant product regardless of package size.

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

  const normalizedQuery = query.trim().toLowerCase();
  const store = products[0]?.store ?? 'unknown';

  // ── Cache read ────────────────────────────────────────────────────────────
  try {
    const supabase = await createClient();
    const { data: cached } = await supabase
      .from('semantic_cache')
      .select('best_match_id, confidence, reasoning, total_qty, total_qty_unit')
      .eq('query', normalizedQuery)
      .eq('store', store)
      .maybeSingle();

    if (cached) {
      const cachedIdx = products.findIndex((p) => p.id === cached.best_match_id);
      if (cachedIdx !== -1) {
        console.log(`[groq] Cache HIT for "${query}" (${store}) → "${cached.best_match_id}" confidence ${cached.confidence}`);
        const updated = [...products];
        const chosen = {
          ...updated[cachedIdx],
          match_score: cached.confidence,
          ai_reasoning: cached.reasoning ?? undefined,
          ...(cached.total_qty != null ? { normalized_total_qty: Number(cached.total_qty) } : {}),
          ...(cached.total_qty_unit ? { normalized_qty_unit: cached.total_qty_unit } : {}),
        };
        updated.splice(cachedIdx, 1);
        updated.unshift(chosen);
        return updated;
      }
    }
  } catch (err) {
    console.warn('[groq] Cache read failed (non-fatal):', err instanceof Error ? err.message : err);
  }

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

  // ── Cache write (fire-and-forget) ─────────────────────────────────────────
  createClient().then((supabase) =>
    supabase.from('semantic_cache').upsert(
      {
        query: normalizedQuery,
        store,
        best_match_id: result.bestMatchId,
        confidence: result.confidenceScore,
        reasoning: result.reasoning,
        total_qty: result.totalQty ?? null,
        total_qty_unit: result.totalQtyUnit ?? null,
      },
      { onConflict: 'query,store' },
    )
  ).catch((err) =>
    console.warn('[groq] Cache write failed (non-fatal):', err instanceof Error ? err.message : err)
  );

  return updated;
}

// ---------------------------------------------------------------------------
// Grocery Item Text Parser (Groq)
// Parses raw item text like "2 plums" or "1/2 cup flour" into structured data.
// Used as a fallback when the regex normalizer cannot confidently strip quantity
// noise from the product identity (e.g. unusual formats like "2x plums").
// ---------------------------------------------------------------------------

export interface ParsedItemResult {
  /** Numeric quantity to buy; defaults to 1 */
  quantity: number;
  /** Singular product identity with ALL numbers and units stripped (e.g. "plum", "flour") */
  clean_name: string;
  /** Recipe/volume unit (e.g. "cup", "oz", "lb"); null for count items */
  unit: string | null;
}

const PARSE_TIMEOUT_MS = 5_000;

/**
 * Use Groq to parse raw grocery item text into structured { quantity, clean_name, unit }.
 * Returns null on any failure — callers must always have a regex fallback.
 */
export async function parseItemText(rawText: string): Promise<ParsedItemResult | null> {
  const client = getClient();
  if (!client || !rawText.trim()) return null;

  const systemPrompt = `You are a grocery list parser. Convert raw grocery item text into structured JSON.

CRITICAL: The clean_name must be the singular identity of the product with ALL numbers and units removed.

Rules:
1. Strip ALL leading numbers, multipliers (x, ×), and separators (-, +) from clean_name.
2. Singularize the clean_name — e.g. "plums" → "plum", "bananas" → "banana", "tomatoes" → "tomato".
3. Strip cooking units (cup, tbsp, tsp, oz, lb, g, kg, etc.) from clean_name.
4. Remove filler words: "of", "a", "an" from the start of clean_name.
5. Remove preparation/recipe instructions from clean_name (e.g. "torn into bite sized pieces", "pre cooked", "optional").
6. If no quantity is specified, default quantity to 1.
7. unit is null for discrete count items; use the measurement unit string for recipe/volume items.
8. For measurements, quantity should be 1 (buy 1 package that satisfies the amount), NOT the fraction.

Examples:
- "2 plums"                           → {"quantity": 2, "clean_name": "plum",              "unit": null}
- "2x plums"                          → {"quantity": 2, "clean_name": "plum",              "unit": null}
- "1/2 cup flour"                     → {"quantity": 1, "clean_name": "flour",             "unit": "cup"}
- "3 cans of beans"                   → {"quantity": 3, "clean_name": "bean",              "unit": null}
- "500g chicken"                      → {"quantity": 1, "clean_name": "chicken",           "unit": "g"}
- "milk"                              → {"quantity": 1, "clean_name": "milk",              "unit": null}
- "peanut butter"                     → {"quantity": 1, "clean_name": "peanut butter",     "unit": null}
- "2 lbs ground beef"                 → {"quantity": 1, "clean_name": "ground beef",       "unit": "lb"}
- "6-8 flour tortillas torn into bite sized pieces" → {"quantity": 1, "clean_name": "flour tortilla", "unit": null}
- "1 can tomatoes with green chili"   → {"quantity": 1, "clean_name": "tomato with green chili", "unit": null}
- "2 cans verde enchilada sauce"      → {"quantity": 2, "clean_name": "verde enchilada sauce", "unit": null}
- "green onion tops optional"         → {"quantity": 1, "clean_name": "green onion",       "unit": null}

Output ONLY a JSON object with exactly these three fields: quantity, clean_name, unit.`;

  try {
    const response = await Promise.race([
      client.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: rawText.trim() },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.0,
        max_tokens: 80,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('parseItemText timeout')), PARSE_TIMEOUT_MS),
      ),
    ]);

    const raw = response.choices[0]?.message?.content;
    if (!raw) return null;

    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed: unknown = JSON.parse(cleaned);

    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'clean_name' in parsed &&
      typeof (parsed as Record<string, unknown>).clean_name === 'string'
    ) {
      const obj = parsed as Record<string, unknown>;
      const clean_name = String(obj.clean_name).trim().toLowerCase();
      if (!clean_name) return null;

      const quantity =
        obj.quantity != null && !isNaN(Number(obj.quantity))
          ? Math.max(1, Math.round(Number(obj.quantity)))
          : 1;

      const unit =
        obj.unit != null && obj.unit !== 'null' && typeof obj.unit === 'string' && obj.unit.trim()
          ? String(obj.unit).trim().toLowerCase()
          : null;

      return { quantity, clean_name, unit };
    }
    return null;
  } catch (err) {
    console.warn('[groq:parseItemText] failed:', err instanceof Error ? err.message : err);
    return null;
  }
}
