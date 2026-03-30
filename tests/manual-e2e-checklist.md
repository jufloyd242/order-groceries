# Manual E2E Test Checklist: Add → Compare → Change → Verify

**Purpose**: Verify the complete workflow (add items, compare prices, change product selection, return to comparison) works correctly without data loss or display issues.

**Prerequisites**:
- Dev server running on `http://localhost:3000`
- Kroger location ID configured in Settings
- Network connectivity for API calls

---

## Test Scenario 1: Add Items & Verify List

### Test 1.1: Add Single Item
- [ ] Open `http://localhost:3000` (home page)
- [ ] In "Add items" input, type: `milk`
- [ ] Click `+` button (or use qty stepper set to 1)
- **Expected**: 
  - "milk" appears in "TODAY'S LIST" section
  - Item shows status "⚠️ new — needs product pick"
  - Count shows "1 item"

### Test 1.2: Add Multiple Items
- [ ] Type `bread` in input, click `+` to add
- [ ] Type `apples` in input, click `+` to add
- **Expected**: 
  - All 3 items (milk, bread, apples) appear in list
  - Count shows "3 items"
  - All show "⚠️ new" status

### Test 1.3: Verify List Retrieval via API
- [ ] Open DevTools → Network tab
- [ ] Check `/api/list` request
- [ ] Should return `count: 3` and all 3 items with correct data
- **Expected**: API returns all added items

---

## Test Scenario 2: Navigate to Comparison & Verify Prices

### Test 2.1: Open Comparison Page
- [ ] Click "🔍 Compare Prices (3 items)" button at bottom
- [ ] Wait for page to load (loading spinner may appear)
- **Expected**: 
  - Navigation to `/compare` page
  - 3 items display with their prices

### Test 2.2: Verify All Items Show Prices
- [ ] Wait for comparison results to fully load
- [ ] For each item (milk, bread, apples):
  - [ ] Item name visible
  - [ ] King Soopers price visible (e.g., "$2.29")
  - [ ] Price is NOT "Not Found" or "0"
  - [ ] Amazon column shows price or "Price Unavailable"
- **Expected**: All 3 items have valid Kroger prices

### Test 2.3: Verify Winner Calculation
- [ ] Check "Total Savings" header
- [ ] Verify each item shows:
  - [ ] "KING SOOPERS" header with price
  - [ ] "AMAZON" header with price or "Unavailable"
  - [ ] Winner indicated (green highlight or badge)
- **Expected**: Summary shows total cart value

---

## Test Scenario 3: Change Product & Save Preference

### Test 3.1: Open Product Picker for One Item
- [ ] Click "Change KS ▼" button for **milk** (not bread/apples)
- [ ] Wait for picker page to load (`/pick/[id]?store=kroger`)
- **Expected**: 
  - Product search results appear
  - Shows milk products with prices
  - Each product clickable

### Test 3.2: Select & Save Product
- [ ] Click on **first** milk product in list
- [ ] Verify form populates with:
  - [ ] Product name (e.g., "Whole Milk")
  - [ ] Brand dropdown (optional)
  - [ ] Store preference = "King Soopers"
- [ ] Check the checkbox: "Remember this choice"
- [ ] Click "Save & Return" button
- **Expected**: 
  - No error toast/message
  - Automatically return to `/compare` page
  - No blank screen or missing data

---

## Test Scenario 4: Verify Data Persistence After Return

### Test 4.1: CRITICAL - Check All Prices Still Display
- [ ] After return from picker, verify:
  - [ ] Milk still shows price (may be same or different based on selection)
  - [ ] **Bread** still shows price (should be UNCHANGED)
  - [ ] **Apples** still shows price (should be UNCHANGED)
  - [ ] NO "Not Found" errors
  - [ ] NO null/undefined prices
- **Expected**: All 3 items maintain correct prices

### Test 4.2: Verify Changed Item Updated
- [ ] Milk row should show the product you selected in picker
- [ ] Price matches what you saw in picker
- **Expected**: Changed item reflects preference

### Test 4.3: Test Changing Second Item
- [ ] Click "Change KS ▼" for **bread** (different from milk)
- [ ] Select a product and save
- [ ] Return to comparison
- **Critical Checks**:
  - [ ] Milk price unchanged from 4.1
  - [ ] Bread updated to new selection
  - [ ] Apples price unchanged
  - [ ] NO blank prices anywhere
- **Expected**: Changing bread doesn't affect milk or apples

---

## Test Scenario 5: Quantity Support

### Test 5.1: Add Item with Quantity
- [ ] Go back to home: click "← Back to Shopping List" or home button
- [ ] Delete all items (optional, or add to existing list)
- [ ] Use quantity stepper (−/+ buttons):
  - [ ] Click `+` button twice to set qty = 3
  - [ ] Type `milk` in input
  - [ ] Click `+` to add
- **Expected**: 
  - Item added as "3 milk" (or with qty syntax)
  - List shows item with qty badge: "milk ×3"

### Test 5.2: Verify Quantity in Comparison
- [ ] Click "Compare Prices"
- [ ] Milk row should display
- [ ] Quantity metadata should be stored (qty = 3)
- **Expected**: Item displays correctly with qty info

### Test 5.3: Cart Push with Quantity
- [ ] On comparison page: click "🛒 Add All to King Soopers Cart"
- [ ] If Kroger login popup appears: log in (if testing full flow)
- [ ] After success, check your Kroger cart (if possible)
- **Expected**: Cart shows milk with qty = 3 (not qty = 1)

---

## Test Scenario 6: Session Caching (Bonus)

### Test 6.1: Verify Cache Functionality
- [ ] Open DevTools → Application → Session Storage
- [ ] Look for key: `sgo_comparison_cache`
- [ ] Value should contain JSON with comparison results
- **Expected**: Session storage populated after comparison

### Test 6.2: Verify Instant Load on Return
- [ ] This is internal testing: cache restores results instantly on navigate back
- [ ] Without cache, page would show blank while loading
- [ ] With cache, prices appear immediately, then refresh silently
- **Expected**: No jarring blank page transitions

---

## Test Scenario 7: Preferences Admin Page

### Test 7.1: View Saved Preferences
- [ ] Click ⚙️ (Preferences) button in header
- [ ] Should navigate to `/preferences` page
- [ ] Verify saved products list shows:
  - [ ] Milk (if saved in tests above)
  - [ ] Any other products you saved
- [ ] Each entry shows:
  - [ ] Generic name
  - [ ] Display name
  - [ ] Brand
  - [ ] Stats (optional)
- **Expected**: Preferences page displays all saved choices

### Test 7.2: Edit Preference
- [ ] Click ✏️ (edit) button next to a preference
- [ ] Edit form appears
- [ ] Change brand or display name
- [ ] Click "Update"
- **Expected**: 
  - Preference updated in list
  - No error messages

### Test 7.3: Delete Preference
- [ ] Click 🗑️ (delete) button next to a preference
- [ ] Confirm deletion if prompted
- [ ] Preference removed from list
- **Expected**: Deletion works without errors

---

## Test Scenario 8: Browser Navigation

### Test 8.1: Back Button After Change
- [ ] Add 2 items and compare
- [ ] Change one product and save (return to compare)
- [ ] Click browser back button (←)
- [ ] Should navigate back to home
- [ ] Click "Compare Prices" again
- [ ] Changed preference should still be in effect
- **Expected**: Browser history works, preferences persist

---

## Test Summary

| Test | ✓ | Notes |
|------|---|-------|
| Add single item | ☐ | |
| Add multiple items | ☐ | |
| Compare shows prices | ☐ | |
| All items have prices | ☐ | |
| Change one product | ☐ | |
| Return from picker | ☐ | |
| All prices still show | ☐ | |
| Other items unchanged | ☐ | |
| Quantity stepper works | ☐ | |
| Qty in list badge | ☐ | |
| Qty in comparison | ☐ | |
| Cart push uses qty | ☐ | |
| Preferences CRUD | ☐ | |
| Session cache | ☐ | |
| Browser history | ☐ | |

---

## Issues Found During Testing

| Issue | Severity | Notes |
|-------|----------|-------|
| | | |
| | | |
| | | |

---

## Pass/Fail Summary

- **Total Tests**: 14
- **Passed**: ☐
- **Failed**: ☐
- **Critical Issues Found**: ☐ Yes ☐ No

**If any test fails, note details in "Issues Found" section above and report to developer.**
