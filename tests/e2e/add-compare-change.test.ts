/**
 * E2E Test Suite: Add Item → Compare → Change Product → Verify Consistency
 */

describe('E2E: Add → Compare → Change → Verify', () => {
  const baseURL = 'http://localhost:3000'

  beforeAll(async () => {
    try {
      // Seed Kroger location ID
      await fetch(`${baseURL}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kroger_location_id: '04400835'
        }),
      }).catch(() => {})
    } catch (err) {}
  })

  beforeEach(async () => {
    try {
      const res = await fetch(`${baseURL}/api/list`)
      const { items } = await res.json()
      for (const item of items) {
        await fetch(`${baseURL}/api/list`, {
          method: 'DELETE',
          body: JSON.stringify({ id: item.id }),
        })
      }
    } catch (e) {}
  })

  test('Test 1.1: Add single item', async () => {
    const res = await fetch(`${baseURL}/api/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ raw_text: 'milk', source: 'manual' }],
      }),
    })
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.added).toBe(1)
  })

  test('Test 1.2: Add multiple items', async () => {
    const res = await fetch(`${baseURL}/api/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [
          { raw_text: 'milk', source: 'manual' },
          { raw_text: 'bread', source: 'manual' },
        ],
      }),
    })

    const res = await fetch(`${baseURL}/api/list`)
    const data = await res.json()
    expect(data.count).toBe(2)
    expect(data.items.length).toBe(2)
  })

  test('Test 2.1: Compare endpoint returns results', async () => {
    await fetch(`${baseURL}/api/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ raw_text: 'milk', source: 'manual' }],
      }),
    })

    const res = await fetch(`${baseURL}/api/compare`)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.results.length).toBeGreaterThan(0)
  })

  test('Test 2.2: Items have Kroger prices', async () => {
    await fetch(`${baseURL}/api/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ raw_text: 'milk', source: 'manual' }],
      }),
    })

    const res = await fetch(`${baseURL}/api/compare`)
    const data = await res.json()
    expect(data.results[0].selected_kroger).toBeDefined()
    expect(data.results[0].selected_kroger.price).toBeGreaterThan(0)
  })

  test('Test 2.3: Summary is calculated', async () => {
    await fetch(`${baseURL}/api/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [
          { raw_text: 'milk', source: 'manual' },
          { raw_text: 'bread', source: 'manual' },
        ],
      }),
    })

    const res = await fetch(`${baseURL}/api/compare`)
    const data = await res.json()
    expect(data.summary).toBeDefined()
    expect(data.summary.totalItems).toBe(2)
    expect(data.summary.krogerCartTotal).toBeGreaterThan(0)
  })

  test('Test 3.1: Save product preference', async () => {
    const res = await fetch(`${baseURL}/api/preferences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

  test('Test 3.2: Retrieve saved preferences', async () => {
    await fetch(`${baseURL}/api/preferences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        generic_name: 'test_item',
        display_name: 'Test Product',
        preferred_upc: 'TEST-UUID-123',
        preferred_brand: 'Test',
      }),
    })

    const res = await fetch(`${baseURL}/api/preferences`)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(Array.isArray(data.preferences)).toBe(true)
  })

  test('Test 4.1: Changing product preserves other item prices', async () => {
    // Add multiple items
    await fetch(`${baseURL}/api/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [
          { raw_text: 'milk', source: 'manual' },
          { raw_text: 'bread', source: 'manual' },
          { raw_text: 'apples', source: 'manual' },
        ],
      }),
    })

    // Get initial prices
    const initial = await fetch(`${baseURL}/api/compare`)
    const initialData = await initial.json()
    const breadInitialPrice = initialData.results.find(
      (r: any) => r.item.raw_text === 'bread'
    )?.selected_kroger?.price

    // Save preference for milk
    await fetch(`${baseURL}/api/preferences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        generic_name: 'milk',
        display_name: 'Milk Preference',
        preferred_upc: 'PREF-MILK-001',
        preferred_brand: 'Brand A',
      }),
    })

    // Get prices after change
    const final = await fetch(`${baseURL}/api/compare`)
    const finalData = await final.json()
    const breadFinalPrice = finalData.results.find(
      (r: any) => r.item.raw_text === 'bread'
    )?.selected_kroger?.price

    // Bread price should not change when we change milk
    expect(breadInitialPrice).toBe(breadFinalPrice)

    // All items should still have prices
    finalData.results.forEach((result: any) => {
      expect(result.selected_kroger).toBeDefined()
      expect(result.selected_kroger.price).toBeGreaterThan(0)
    })
  })

  test('Test 4.2: Quantity parsing in items', async () => {
    const res = await fetch(`${baseURL}/api/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ raw_text: '3 milk', source: 'manual' }],
      }),
    })

    const listRes = await fetch(`${baseURL}/api/list`)
    const data = await listRes.json()
    expect(data.items[0].quantity).toBe(3)
  })

  test('Test 4.3: Quantity preserved in comparison', async () => {
    await fetch(`${baseURL}/api/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [
          { raw_text: '2 milk', source: 'manual' },
          { raw_text: '3 bread', source: 'manual' },
        ],
      }),
    })

    const res = await fetch(`${baseURL}/api/compare`)
    const data = await res.json()

    const milk = data.results.find((r: any) => r.item.raw_text === '2 milk')
    const bread = data.results.find((r: any) => r.item.raw_text === '3 bread')

    expect(milk?.item.quantity).toBe(2)
    expect(bread?.item.quantity).toBe(3)
    expect(milk?.selected_kroger.price).toBeGreaterThan(0)
    expect(bread?.selected_kroger.price).toBeGreaterThan(0)
  })

  test('Test 5.1: Gracefully handle unfound items', async () => {
    await fetch(`${baseURL}/api/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [
          { raw_text: 'milk', source: 'manual' },
          { raw_text: 'xyzabcnotreal99', source: 'manual' },
        ],
      }),
    })

    const res = await fetch(`${baseURL}/api/compare`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data.results)).toBe(true)
  })

  test('Test 5.2: Handle empty list gracefully', async () => {
    const res = await fetch(`${baseURL}/api/compare`)
    expect(res.status).toBe(200)
    const data = await res.json()
    // Empty list should return array, not crash
    expect(Array.isArray(data.results) || data.results === undefined).toBe(true)
  })
})
