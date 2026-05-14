import { ProductMatch } from '@/types';
import { createClient } from '@/lib/supabase/server';

// ---------------------------------------------------------------------------
// Gemini AI Semantic Match Evaluator
// Uses gemini-2.5-flash-lite (stable alias) via the OpenAI-compatible endpoint.
// No extra npm packages — plain fetch. Model is overridable via GEMINI_MODEL
// so you never need to touch code when Google updates the alias.
// ---------------------------------------------------------------------------

const MODEL              = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash-lite';
const CONFIDENCE_THRESHOLD = 80;
const TIMEOUT_MS         = 10_000;
const GEMINI_URL         = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

export interface SemanticMatchResult {
  bestMatchId: string;
  confidenceScore: number;
  reasoning: string;
  totalQty?: number;
  totalQtyUnit?: string;
}

/**
 * Send the user's search query and a list of candidate products to Gemini.
 * The LLM picks the single best match, returns a confidence score & reasoning.
 *
 * Returns `null` on any failure so the caller can fall back to fuzzy scoring.
 */
export async function evaluateSemanticMatch(
  query: string,
  candidates: ProductMatch[],
): Promise<SemanticMatchResult | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || candidates.length === 0) return null;

  const top = candidates.slice(0, 10);
  const productList = top
    .map(
      (p, i) =>
        `${i + 1}. [id=${p.id}] "${p.name}" | Brand: ${p.brand} | Size: ${p.size} | Dept: ${p.department ?? 'unknown'} | $${p.price}`,
    )
    .join('\n');

  // The store name helps Gemini reason about which brands are native to the store
  const storeName = top[0]?.store === 'kroger' ? 'King Soopers (Kroger)' : 'Amazon';

  const systemPrompt = `You are a grocery product matcher for ${storeName}.
The user wants: "${query}" (abbreviations are already expanded — take the query literally).
Below are candidate products sorted by text similarity, best match first.

MATCHING RULES (follow in order):
1. Generic brand equivalence: "Simple Truth"/"Kroger" brand (King Soopers) = "365" (Amazon) = "Great Value" (Walmart). Treat these as identical for matching purposes.
2. Form is critical — do NOT cross these boundaries:
   - "butter" ≠ "peanut butter"
   - "milk" ≠ "milk chocolate" or "almond milk" (unless query specifies)
   - "chicken" ≠ "chicken broth" or "chicken soup"
   - "cheese" ≠ "cream cheese" (unless query says cream cheese)
3. Size preference for staples: prefer standard/common sizes (gallon milk, dozen eggs, 1 lb butter, 1 lb loaf bread).
4. When multiple candidates are equally close in name/brand, prefer the lower-priced option.
5. Always return something — a low-confidence match is better than no match, unless results are completely unrelated (e.g., searching "milk" but all results are electronics).

SIZE EXTRACTION for the best match:
- Multi-pack (e.g. "6 x 16.9 fl oz", "12 mega rolls"): compute the TOTAL quantity.
- Weight/volume: normalize to oz (solids) or fl oz (liquids).
- Count items (rolls, sheets, packs): use total count.

OUTPUT: Return ONLY a JSON object with exactly these fields, no markdown or code fences:
{
  "bestMatchId": "<exact id string from the candidate list>",
  "confidenceScore": <number 0-100>,
  "reasoning": "<one sentence, e.g. 'Matched store-brand 2% milk gallon'>",
  "totalQty": <number or null>,
  "totalQtyUnit": "<oz|fl oz|ct or null>"
}`;

  const userPrompt = `User wants: "${query}"\n\nCandidates (sorted best fuzzy match first):\n${productList}`;

  try {
    const fetchResult = await Promise.race([
      fetch(GEMINI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user',   content: userPrompt   },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
          max_tokens: 200,
        }),
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Gemini timeout')), TIMEOUT_MS),
      ),
    ]);

    if (!fetchResult.ok) {
      const errText = await fetchResult.text().catch(() => '');
      console.warn(`[gemini] HTTP ${fetchResult.status}: ${errText.slice(0, 300)}`);
      return null;
    }

    const data = (await fetchResult.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return null;

    // Strip markdown fences in case the model wraps output anyway
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const parsed: unknown = JSON.parse(cleaned);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'bestMatchId' in parsed &&
      'confidenceScore' in parsed &&
      'reasoning' in parsed
    ) {
      const obj            = parsed as Record<string, unknown>;
      const bestMatchId    = String(obj.bestMatchId);
      const confidenceScore = Math.max(0, Math.min(100, Math.round(Number(obj.confidenceScore))));
      const reasoning      = String(obj.reasoning).slice(0, 250);

      const exists = top.some((p) => p.id === bestMatchId);
      if (!exists) {
        console.warn(`[gemini] Returned bestMatchId "${bestMatchId}" not found in candidates — ignoring`);
        return null;
      }

      const rawQty  = obj.totalQty;
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
    console.warn('[gemini] evaluateSemanticMatch failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Apply AI semantic matching to a set of scored products.
 *
 * Strategy:
 * - If the top fuzzy match scores >= 80, it's confident enough — skip AI.
 * - Otherwise, send candidates to Gemini to pick the best semantic match.
 * - The AI-chosen product gets promoted to position 0 with the AI's confidence
 *   score and reasoning attached.
 * - If GEMINI_API_KEY is not set or AI fails, returns products unchanged.
 */
export async function applySemanticMatching(
  query: string,
  products: ProductMatch[],
): Promise<ProductMatch[]> {
  if (!process.env.GEMINI_API_KEY || products.length === 0) return products;

  const topScore = products[0]?.match_score ?? 0;
  if (topScore >= CONFIDENCE_THRESHOLD) return products;

  const normalizedQuery = query.trim().toLowerCase();
  const store = products[0]?.store ?? 'unknown';

  // ── Cache read ─────────────────────────────────────────────────────────────
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
        console.log(`[gemini] Cache HIT for "${query}" (${store}) → "${cached.best_match_id}" confidence ${cached.confidence}`);
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
    console.warn('[gemini] Cache read failed (non-fatal):', err instanceof Error ? err.message : err);
  }

  console.log(
    `[gemini] Top fuzzy score for "${query}" is ${products[0]?.match_score ?? 0} — invoking semantic matching on ${products.length} candidate(s) with model ${MODEL}`,
  );

  const result = await evaluateSemanticMatch(query, products);
  if (!result) return products;

  console.log(
    `[gemini] Semantic match for "${query}": picked "${result.bestMatchId}" with confidence ${result.confidenceScore} — ${result.reasoning}`,
  );

  const aiIdx = products.findIndex((p) => p.id === result.bestMatchId);
  if (aiIdx === -1) return products;

  const updated = [...products];
  const chosen = {
    ...updated[aiIdx],
    match_score:  result.confidenceScore,
    ai_reasoning: result.reasoning,
    ...(result.totalQty     !== undefined ? { normalized_total_qty: result.totalQty }     : {}),
    ...(result.totalQtyUnit !== undefined ? { normalized_qty_unit:  result.totalQtyUnit } : {}),
  };
  updated.splice(aiIdx, 1);
  updated.unshift(chosen);

  // ── Cache write (fire-and-forget) ─────────────────────────────────────────
  createClient().then((supabase) =>
    supabase.from('semantic_cache').upsert(
      {
        query:          normalizedQuery,
        store,
        best_match_id:  result.bestMatchId,
        confidence:     result.confidenceScore,
        reasoning:      result.reasoning,
        total_qty:      result.totalQty ?? null,
        total_qty_unit: result.totalQtyUnit ?? null,
      },
      { onConflict: 'query,store' },
    ),
  ).catch((err) =>
    console.warn('[gemini] Cache write failed (non-fatal):', err instanceof Error ? err.message : err),
  );

  return updated;
}

// ---------------------------------------------------------------------------
// Grocery Item Text Parser
// Parses raw item text like "2 plums" or "1/2 cup flour" into structured data.
// Used as a fallback when the regex normalizer cannot confidently strip quantity
// noise from the product identity (e.g. unusual formats like "2x plums").
// ---------------------------------------------------------------------------

const PARSE_TIMEOUT_MS = 5_000;

export interface ParsedItemResult {
  /** Numeric quantity to buy; defaults to 1 */
  quantity: number;
  /** Singular product identity with ALL numbers and units stripped (e.g. "plum", "flour") */
  clean_name: string;
  /** Recipe/volume unit (e.g. "cup", "oz", "lb"); null for count items */
  unit: string | null;
}

/**
 * Use Gemini to parse raw grocery item text into structured { quantity, clean_name, unit }.
 *
 * CRITICAL rules baked into the prompt:
 * - clean_name must be singular and free of all numbers/units
 * - Defaults to quantity=1 when no amount is specified
 *
 * Returns null on any failure — callers must always have a regex fallback.
 */
export async function parseItemText(rawText: string): Promise<ParsedItemResult | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !rawText.trim()) return null;

  const systemPrompt = `You are a grocery list parser. Convert raw grocery item text into structured JSON.

CRITICAL: The clean_name must be the singular identity of the product with ALL numbers and units removed.

Rules:
1. Strip ALL leading numbers, multipliers (x, ×), and separators (-, +) from clean_name.
2. Singularize the clean_name — e.g. "plums" → "plum", "bananas" → "banana", "tomatoes" → "tomato".
3. Strip cooking units (cup, tbsp, tsp, oz, lb, g, kg, etc.) from clean_name.
4. Remove filler words: "of", "a", "an" from the start of clean_name.
5. If no quantity is specified, default quantity to 1.
6. unit is null for discrete count items; use the measurement unit string for recipe/volume items.
7. For measurements, quantity should be 1 (buy 1 package that satisfies the amount), NOT the fraction.

Examples:
- "2 plums"        → {"quantity": 2, "clean_name": "plum",         "unit": null}
- "2x plums"       → {"quantity": 2, "clean_name": "plum",         "unit": null}
- "1/2 cup flour"  → {"quantity": 1, "clean_name": "flour",        "unit": "cup"}
- "3 cans of beans"→ {"quantity": 3, "clean_name": "bean",         "unit": null}
- "500g chicken"   → {"quantity": 1, "clean_name": "chicken",      "unit": "g"}
- "milk"           → {"quantity": 1, "clean_name": "milk",         "unit": null}
- "peanut butter"  → {"quantity": 1, "clean_name": "peanut butter","unit": null}
- "2 lbs ground beef" → {"quantity": 1, "clean_name": "ground beef", "unit": "lb"}

Output ONLY a JSON object with exactly these three fields: quantity, clean_name, unit.`;

  try {
    const fetchResult = await Promise.race([
      fetch(GEMINI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user',   content: rawText.trim() },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.0,
          max_tokens: 80,
        }),
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('parseItemText timeout')), PARSE_TIMEOUT_MS),
      ),
    ]);

    if (!fetchResult.ok) {
      console.warn(`[gemini:parseItemText] HTTP ${fetchResult.status}`);
      return null;
    }

    const data = (await fetchResult.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = data.choices?.[0]?.message?.content;
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

      const quantity = obj.quantity != null && !isNaN(Number(obj.quantity))
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
    console.warn('[gemini:parseItemText] failed:', err instanceof Error ? err.message : err);
    return null;
  }
}
