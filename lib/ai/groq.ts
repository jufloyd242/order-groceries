import Groq from 'groq-sdk';
import { ProductMatch } from '@/types';

// ---------------------------------------------------------------------------
// Groq AI Match Evaluator
// Uses Llama 3.1 70B to semantically evaluate whether a product matches a
// grocery search query. Only invoked for "ambiguous" fuzzy scores (30–70).
// ---------------------------------------------------------------------------

const MODEL = 'llama-3.1-70b-versatile';
const AMBIGUOUS_LOW = 30;
const AMBIGUOUS_HIGH = 70;
const TIMEOUT_MS = 5_000;

interface MatchEvaluation {
  confidence: number;
  reasoning: string;
}

function getClient(): Groq | null {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  return new Groq({ apiKey });
}

/**
 * Ask the LLM whether `product` is a good match for the user's `query`.
 * Returns a confidence 0–100 and a short reasoning string.
 * On any failure, returns `null` so the caller can keep the original fuzzy score.
 */
export async function evaluateProductMatch(
  query: string,
  product: ProductMatch,
): Promise<MatchEvaluation | null> {
  const client = getClient();
  if (!client) return null;

  const systemPrompt = `You are a grocery product matching expert. Given a user's search query and a candidate product, evaluate how well the product matches what the user is looking for.

Consider:
- Brand variations (store brand vs name brand for the same product)
- Size/quantity relevance
- Product category match (e.g. "milk" should match "2% Reduced Fat Milk" but not "Milk Chocolate")
- Common abbreviations and synonyms

Respond with JSON only: {"confidence": <number 0-100>, "reasoning": "<one sentence>"}`;

  const userPrompt = `Search query: "${query}"
Candidate product: "${product.name}"
Brand: "${product.brand}"
Size: "${product.size}"
Department: "${product.department ?? 'unknown'}"
Current fuzzy score: ${product.match_score}`;

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
        max_tokens: 150,
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
      'confidence' in parsed &&
      'reasoning' in parsed
    ) {
      const { confidence, reasoning } = parsed as MatchEvaluation;
      const clampedConfidence = Math.max(0, Math.min(100, Math.round(Number(confidence))));
      return {
        confidence: clampedConfidence,
        reasoning: String(reasoning).slice(0, 200),
      };
    }
    return null;
  } catch (err) {
    console.warn('[groq] evaluateProductMatch failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Re-score products whose fuzzy `match_score` falls in the ambiguous 30–70 range.
 * Products outside that range keep their original score untouched.
 * If GROQ_API_KEY is not set, returns products unchanged.
 */
export async function reScoreAmbiguousMatches(
  query: string,
  products: ProductMatch[],
): Promise<ProductMatch[]> {
  if (!process.env.GROQ_API_KEY) return products;

  const ambiguous: { index: number; product: ProductMatch }[] = [];
  for (let i = 0; i < products.length; i++) {
    const score = products[i].match_score;
    if (score >= AMBIGUOUS_LOW && score <= AMBIGUOUS_HIGH) {
      ambiguous.push({ index: i, product: products[i] });
    }
  }

  if (ambiguous.length === 0) return products;

  console.log(
    `[groq] Re-scoring ${ambiguous.length} ambiguous match(es) for "${query}"`,
  );

  const results = await Promise.allSettled(
    ambiguous.map(({ product }) => evaluateProductMatch(query, product)),
  );

  const updated = [...products];
  for (let i = 0; i < ambiguous.length; i++) {
    const outcome = results[i];
    if (outcome.status === 'fulfilled' && outcome.value) {
      const { confidence, reasoning } = outcome.value;
      const orig = ambiguous[i];
      console.log(
        `[groq] "${orig.product.name}" rescored: ${orig.product.match_score} → ${confidence} (${reasoning})`,
      );
      updated[orig.index] = {
        ...updated[orig.index],
        match_score: confidence,
        ai_reasoning: reasoning,
      };
    }
  }

  // Re-sort by match_score descending after AI adjustment
  return updated.sort((a, b) => b.match_score - a.match_score);
}
