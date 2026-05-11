/**
 * E2E Test Suite: Add Item → Compare → Change Product → Verify Consistency
 *
 * All requests include Authorization: Bearer <token> so these tests work
 * correctly when RLS is enabled in Supabase.
 *
 * Auth configuration (in .env.local):
 *   TEST_ACCESS_TOKEN   — pre-obtained JWT (easiest — get from /api/dev/token after signing in)
 *   or:
 *   TEST_USER_EMAIL + TEST_USER_PASSWORD + SUPABASE_SERVICE_ROLE_KEY (auto sign-in)
 */

import { authHeaders } from '../helpers/auth';

describe('E2E: Add → Compare → Change → Verify', () => {
  const baseURL = 'http://localhost:3000'
  let headers: Record<string, string>;

  beforeAll(async () => {
    headers = await authHeaders();

    // Seed Kroger location ID so compare tests have a real store
    await fetch(`${baseURL}/api/settings`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ kroger_location_id: '04400835' }),
    }).catch(() => {});
  })

  beforeEach(async () => {
    // Clean slate — delete all current list items before each test
    try {
      const res = await fetch(`${baseURL}/api/list`, { headers })
      const { items } = await res.json()
      if (items?.length) {
        await fetch(`${baseURL}/api/list`, {
          method: 'DELETE',
          headers,
          body: JSON.stringify({ ids: items.map((i: any) => i.id) }),
        })
      }
    } catch (e) {}
  })

  // ─── Suite 1: Add Items ────────────────────────────────────────────────────

  test('Test 1.1: Add single item', async () => {
    const res = await fetch(`${baseURL}/api/list`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ items: [{ raw_text: 'milk', source: 'manual' }] }),
    })
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.added).toBe(1)
  })

  test('Test 1.2: Add multiple items', async () => {
    const res = await fetch(`${baseURL}/api/list`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        items: [
          { raw_text: 'milk', source: 'manual' },
          { raw_text: 'bread', source: 'manual' },
          { raw_text: 'apples', source: 'manual' },
        ],
      }),
    })
    const data = await res.json()
    expect(data.added).toBe(3)
  })

  test('Test 1.3: List displays added items', async () => {
    await fetch(`${baseURL}/api/list`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        items: [
          { raw_text: 'milk', source: 'manual' },
          { raw_text: 'bread', source: 'manual' },
        ],
      }),
    })

    const res = await fetch(`${baseURL}/api/list`, { headers })
    const data = await res.json()
    expect(data.count).toBe(2)
    expect(data.items.length).toBe(2)
  })

  test('Test 1.4: Delete an item — removes from DB and UI', async () => {
    await fetch(`${baseURL}/api/list`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        items: [
          { raw_text: 'milk', source: 'manual' },
          { raw_text: 'bread', source: 'manual' },
          { raw_text: 'eggs', source: 'manual' },
        ],
      }),
    })

    const listRes = await fetch(`${baseURL}/api/list`, { headers })
    const { items } = await listRes.json()
    expect(items.length).toBe(3)

    // Delete one
    const toDelete = items.find((i: any) => i.raw_text === 'bread')
    const delRes = await fetch(`${baseURL}/api/list`, {
      method: 'DELETE',
      headers,
      body: JSON.stringify({ id: toDelete.id }),
    })
    const delData = await delRes.json()
    expect(delData.success).toBe(true)
    expect(delData.removed).toBe(1)

    // Confirm only 2 remain
    const afterRes = await fetch(`${baseURL}/api/list`, { headers })
    const afterData = await afterRes.json()
    expect(afterData.items.length).toBe(2)
    expect(afterData.items.find((i: any) => i.raw_text === 'bread')).toBeUndefined()
  })

  // ─── Suite 2: Compare ──────────────────────────────────────────────────────

  test('Test 2.1: Compare endpoint returns results', async () => {
    await fetch(`${baseURL}/api/list`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ items: [{ raw_text: 'milk', source: 'manual' }] }),
    })

    const res = await fetch(`${baseURL}/api/compare`, { headers })
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.results.length).toBeGreaterThan(0)
  })

  test('Test 2.2: Items have Kroger prices', async () => {
    await fetch(`${baseURL}/api/list`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ items: [{ raw_text: 'milk', source: 'manual' }] }),
    })

    const res = await fetch(`${baseURL}/api/compare`, { headers })
    const data = await res.json()
    expect(data.results[0].selected_kroger).toBeDefined()
    expect(data.results[0].selected_kroger.price).toBeGreaterThan(0)
  })

  test('Test 2.3: Summary is calculated', async () => {
    await fetch(`${baseURL}/api/list`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        items: [
          { raw_text: 'milk', source: 'manual' },
          { raw_text: 'bread', source: 'manual' },
        ],
      }),
    })

    const res = await fetch(`${baseURL}/api/compare`, { headers })
    const data = await res.json()
    expect(data.summary).toBeDefined()
    expect(data.summary.totalItems).toBe(2)
    expect(data.summary.krogerCartTotal).toBeGreaterThan(0)
  })

  // ─── Suite 3: Settings ─────────────────────────────────────────────────────

  test('Test 3.0: GET /api/settings always returns a complete object', async () => {
    const res = await fetch(`${baseURL}/api/settings`, { headers })
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.settings).toBeDefined()
    // Required fields must always be present (from SETTING_DEFAULTS fallback)
    expect(typeof data.settings.default_zip_code).toBe('string')
    expect(typeof data.settings.store_chain).toBe('string')
    expect(typeof data.settings.order_modality).toBe('string')
  })

  test('Test 3.1: POST /api/settings saves values', async () => {
    const res = await fetch(`${baseURL}/api/settings`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ kroger_location_id: '04400835' }),
    })
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.success).toBe(true)

    // Read it back and confirm it persisted
    const getRes = await fetch(`${baseURL}/api/settings`, { headers })
    const getData = await getRes.json()
    expect(getData.settings.kroger_location_id).toBe('04400835')
  })

  // ─── Suite 4: Preferences ──────────────────────────────────────────────────

  test('Test 4.1: Save product preference', async () => {
    const res = await fetch(`${baseURL}/api/preferences`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        generic_name: 'milk',
        display_name: 'Whole Milk 1%',
        preferred_upc: 'TEST-UPC-001',
        preferred_brand: 'Test Brand',
      }),
    })
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
  })

  test('Test 4.2: Retrieve saved preferences', async () => {
    await fetch(`${baseURL}/api/preferences`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        generic_name: 'test_item',
        display_name: 'Test Product',
        preferred_upc: 'TEST-UUID-123',
        preferred_brand: 'Test',
      }),
    })

    const res = await fetch(`${baseURL}/api/preferences`, { headers })
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(Array.isArray(data.preferences)).toBe(true)
  })

  // ─── Suite 5: Consistency ──────────────────────────────────────────────────

  test('Test 5.1: Changing product preserves other item prices', async () => {
    await fetch(`${baseURL}/api/list`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        items: [
          { raw_text: 'milk', source: 'manual' },
          { raw_text: 'bread', source: 'manual' },
          { raw_text: 'apples', source: 'manual' },
        ],
      }),
    })

    const initial = await fetch(`${baseURL}/api/compare`, { headers })
    const initialData = await initial.json()
    const breadInitialPrice = initialData.results.find(
      (r: any) => r.item.raw_text === 'bread'
    )?.selected_kroger?.price

    await fetch(`${baseURL}/api/preferences`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        generic_name: 'milk',
        display_name: 'Milk Preference',
        preferred_upc: 'PREF-MILK-001',
        preferred_brand: 'Brand A',
      }),
    })

    const final = await fetch(`${baseURL}/api/compare`, { headers })
    const finalData = await final.json()
    const breadFinalPrice = finalData.results.find(
      (r: any) => r.item.raw_text === 'bread'
    )?.selected_kroger?.price

    expect(breadInitialPrice).toBe(breadFinalPrice)
    finalData.results.forEach((result: any) => {
      expect(result.selected_kroger).toBeDefined()
      expect(result.selected_kroger.price).toBeGreaterThan(0)
    })
  })

  test('Test 5.2: Quantity parsing in items', async () => {
    await fetch(`${baseURL}/api/list`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ items: [{ raw_text: '3 milk', source: 'manual' }] }),
    })

    const listRes = await fetch(`${baseURL}/api/list`, { headers })
    const data = await listRes.json()
    expect(data.items[0].quantity).toBe(3)
  })

  test('Test 5.3: Quantity preserved in comparison', async () => {
    await fetch(`${baseURL}/api/list`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        items: [
          { raw_text: '2 milk', source: 'manual' },
          { raw_text: '3 bread', source: 'manual' },
        ],
      }),
    })

    const res = await fetch(`${baseURL}/api/compare`, { headers })
    const data = await res.json()

    const milk = data.results.find((r: any) => r.item.raw_text === '2 milk')
    const bread = data.results.find((r: any) => r.item.raw_text === '3 bread')

    expect(milk?.item.quantity).toBe(2)
    expect(bread?.item.quantity).toBe(3)
    expect(milk?.selected_kroger.price).toBeGreaterThan(0)
    expect(bread?.selected_kroger.price).toBeGreaterThan(0)
  })

  // ─── Suite 6: Error Handling ───────────────────────────────────────────────

  test('Test 6.1: Gracefully handle unfound items', async () => {
    await fetch(`${baseURL}/api/list`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        items: [
          { raw_text: 'milk', source: 'manual' },
          { raw_text: 'xyzabcnotreal99', source: 'manual' },
        ],
      }),
    })

    const res = await fetch(`${baseURL}/api/compare`, { headers })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data.results)).toBe(true)
  })

  test('Test 6.2: Handle empty list gracefully', async () => {
    const res = await fetch(`${baseURL}/api/compare`, { headers })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data.results) || data.results === undefined).toBe(true)
  })

  test('Test 6.3: Unauthenticated request returns 401', async () => {
    const res = await fetch(`${baseURL}/api/list`)
    expect(res.status).toBe(401)
  })
})
