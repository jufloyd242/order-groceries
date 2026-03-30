# Smart Grocery Optimizer — Implementation Plan (v3)

**Status**: Phase 4 Complete ✅ | Phase 5 In Progress (Deployment) | Phase 6+ (Future Features)

**Last Updated**: March 29, 2026 | **Owner**: Justin Floyd | **Primary User**: Wife

---

## Executive Summary

The Smart Grocery Optimizer is a Next.js web application that automatically identifies which grocery store — King Soopers or Amazon — offers the best prices for items on a Todoist shopping list. The app compares prices in real-time and can push items directly to the winning store's cart with one click.

**What's Done:**
- ✅ Full Next.js + Supabase stack
- ✅ Todoist integration (voice + manual entry)
- ✅ Kroger (King Soopers) API search & OAuth cart push
- ✅ Amazon price search (SerpApi)
- ✅ Fuzzy matching + product preference memory
- ✅ Price comparison dashboard
- ✅ UI components (list, compare, picker, settings)

**What's Left:**
- ⏳ Phase 5A: Final testing & bug fixes (price extraction improvements)
- ⏳ Phase 5B: Docker + Google Cloud Run deployment
- 🔲 Phase 6: Polish & UX improvements
- 🔲 Phase 7: Analytics & price history tracking

---

## Part 1: Resolved Decisions

| Decision | Answer | Notes |
|----------|--------|-------|
| **List Input** | Todoist ("Your Mom for Todoist" Alexa Skill) | Now fully enabled and active ✅ |
| **Amazon Pricing** | SerpApi (free tier: 100 searches/mo) | Fallback to manual selection if no match |
| **Deployment** | Google Cloud Run | Dockerfile & standalone output configured |
| **Default Location** | 80516 (Erie, CO) | King Soopers Vista Ridge (62000129) |
| **Primary User** | Wife | Designed for speed & simplicity |
| **Order Mode** | Delivery | Kroger modality set to DELIVERY |
| **Todoist Project** | "groceries" | Auto-synced every 5 minutes |
| **Product Specificity** | Learn-once mapping | e.g., "apples" → "Honeycrisp 3lb bag" |

---

## Part 2: What You Need to Provide (Credentials)

Copy these keys into `.env.local` (file already created with template):

| Service | Required | Status | Format |
|---------|----------|--------|--------|
| **Todoist API Token** | ✅ | Provided | Bearer token (Settings → Integrations → Developer) |
| **Kroger Client ID & Secret** | ✅ | Provided | From developer.kroger.com (Production app) |
| **SerpApi Key** | ✅ | Provided | From serpapi.com dashboard |
| **Supabase URL & Anon Key** | ✅ | Provided | From supabase.com (project settings) |

> **⚠️ Important**: Never commit `.env.local`. All keys stay local during development. In production (Google Cloud), they're injected via Google Cloud Secret Manager.

---

## Part 3: Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    SMART GROCERY OPTIMIZER                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  FrontEnd (Next.js)                                         │
│  ├─ /                   (Home: Add items manually)          │
│  ├─ /compare            (Price comparison dashboard)        │
│  ├─ /pick/[itemId]      (Product picker for new items)      │
│  └─ /settings           (Location, zip code config)         │
│                                                              │
│  Server-Side APIs (Next.js Route Handlers)                 │
│  ├─ /api/list           (Manage list items)                │
│  ├─ /api/todoist/sync   (Fetch from Todoist)               │
│  ├─ /api/compare        (Multi-store price comparison)     │
│  ├─ /api/preferences    (Save/load product mappings)       │
│  │                                                          │
│  ├─ /api/kroger/        (King Soopers)                     │
│  │  ├─ locations        (Find nearby stores)               │
│  │  ├─ products         (Search for products)              │
│  │  ├─ cart             (Push to shopping cart)            │
│  │  └─ auth/            (OAuth login/callback)             │
│  │                                                          │
│  └─ /api/amazon/        (Amazon via SerpApi)               │
│     └─ products         (Search with zip targeting)        │
│                                                              │
│  Backend Libraries (lib/)                                  │
│  ├─ /todoist            (Task fetching)                    │
│  ├─ /kroger             (Products, auth, cart, tokens)    │
│  ├─ /amazon             (SerpApi search)                   │
│  ├─ /matching           (Normalize, fuzzy match, prefs)    │
│  ├─ /comparison         (Unit conversion, price calc)      │
│  └─ /supabase           (DB client setup)                  │
│                                                              │
│  Database (Supabase/PostgreSQL)                            │
│  ├─ list_items          (Shopping list entries)            │
│  ├─ product_preferences (Learn-once memory)                │
│  ├─ price_history       (Track trends over time)           │
│  ├─ abbreviations       (tp → toilet paper mappings)       │
│  └─ app_settings        (Config + Kroger OAuth tokens)     │
│                                                              │
└─────────────────────────────────────────────────────────────┘

Data Flow:
  Todoist / Manual Input
        ↓
   /api/list (normalize & store)
        ↓
   /api/compare (parallel search: Kroger + Amazon)
        ↓
   Fuzzy matching + preference lookup
        ↓
   Price comparison + unit conversion
        ↓
   Dashboard display (with product picker for new items)
        ↓
   /api/kroger/cart (push winners to King Soopers)
```

---

## Part 4: Current Implementation Status by Phase

### ✅ Phase 1: Foundation (Complete)
- [x] Next.js 16 + TypeScript setup
- [x] Supabase PostgreSQL integration
- [x] Environment variable template (.env.local)
- [x] Type definitions (types/index.ts)
- [x] Todoist REST API v2 client
- [x] Core utilities (normalization, fuzzy matching, unit conversion)

### ✅ Phase 2: API Integrations (Complete)
- [x] Kroger OAuth authentication (client credentials + authorization code flows)
- [x] Kroger product search with location-aware inventory
- [x] Kroger store location lookup (by zip code)
- [x] SerpApi Amazon product search with zip targeting
- [x] Server-side API proxies (keep tokens hidden from frontend)

### ✅ Phase 3: Core UI (Complete)
- [x] Home page (add items manually, Todoist sync button)
- [x] Comparison dashboard (/compare) with side-by-side price display
- [x] Product picker (/pick/[itemId]) for manual brand/size selection
- [x] Settings page (/settings) for zip code & location config
- [x] Cart summary footer showing item count & savings

### ✅ Phase 4: Cart Push (Complete)
- [x] Persistent OAuth token storage (Supabase app_settings)
- [x] Automatic token refresh (when expired)
- [x] "Sign in with King Soopers" flow (/api/kroger/auth/authorize + /callback)
- [x] Batch cart push (/api/kroger/cart with modality: DELIVERY)
- [x] Integration with comparison dashboard ("Add to KS Cart" button)

### ⏳ Phase 5A: Quality Assurance & Bug Fixes (In Progress)
- [x] Price extraction robustness (fallback fields for Kroger fulfillment prices)
- [x] Price extraction robustness (parse SerpApi alternative price formats)
- [x] Filter $0 prices from winning calculations
- [ ] End-to-end testing (manual flow: add item → search → compare → pick → push)
- [ ] Edge case handling (out of stock, region restrictions, API errors)
- [ ] Error messaging on UI (show why a product wasn't found)
- [ ] User feedback loop (email/Slack on cart errors)

### ⏳ Phase 5B: Deployment (Next)
- [ ] Docker image build & test locally
- [ ] Google Cloud Run setup (create service, configure triggers)
- [ ] Google Cloud Secret Manager integration (inject env vars at runtime)
- [ ] Database migrations on GCP-hosted Supabase
- [ ] Domain setup (custom domain or Cloud Run default)
- [ ] Monitoring & logging (Cloud Logging for errors)
- [ ] CI/CD pipeline (auto-deploy on git push, if desired)

### 🔲 Phase 6: Polish & UX (Future)
- [ ] Mobile-friendly responsive design (currently desktop-optimized)
- [ ] Loading states & skeleton screens during API calls
- [ ] Toast notifications (success/error feedback)
- [ ] Caching layer for frequent searches (Redis or SWR)
- [ ] Dark mode toggle
- [ ] Shortcut to quickly re-add last week's items

### 🔲 Phase 7: Analytics & History (Future)
- [ ] Price history trends chart (show savings over time)
- [ ] "Most savings" / "Most frequently purchased" leaderboard
- [ ] Export comparison reports (PDF or CSV)
- [ ] Kroger loyalty points tracking (if available via API)
- [ ] Budget alerts ("items over $X" warning)

---

## Part 4b: Feature Priority Guide

### Why Priorities Matter
These features affect **user experience** and **time to deployment**. High-priority features should be completed before Phase 5B deployment. Medium/Low priorities can be added post-launch.

### Phase 6: Polish & UX (High Impact)

| Feature | Time | Priority | Why | Ideal Timeline |
|---------|------|----------|-----|-----------------|
| Mobile-responsive design | 4-6 hrs | **HIGH** | Wife likely uses phone | Before/after deployment |
| Loading states & skeleton screens | 2-3 hrs | **HIGH** | Better user feedback during searches | Before deployment |
| Toast notifications (success/error) | 1-2 hrs | **HIGH** | Users know actions succeeded | Before deployment |
| Re-add last week's items shortcut | 1-2 hrs | **MEDIUM** | Quick convenience (especially weekly shoppers) | After deployment |
| Caching layer (SWR or Redis) | 3-4 hrs | MEDIUM | If SerpApi free tier gets exhausted | After deployment |
| Dark mode toggle | 2-3 hrs | LOW | Nice-to-have, doesn't affect core functionality | Nice-to-have |

### Phase 7: Analytics & History (Medium Impact)

| Feature | Time | Priority | Why | Ideal Timeline |
|---------|------|----------|-----|-----------------|
| Price history trends chart | 4-5 hrs | MEDIUM | See savings over time, identify patterns | Post-deployment |
| Budget alerts ("items over $X") | 2-3 hrs | MEDIUM | Help wife control spending | Post-deployment |
| Loyalty points tracking | 2-3 hrs | LOW | Only if Kroger API supports it | Nice-to-have |
| Export reports (PDF/CSV) | 3-4 hrs | LOW | Less critical for individual use | Nice-to-have |
| "Most savings" leaderboard | 2-3 hrs | LOW | Gamification (fun but not essential) | Nice-to-have |

### Recommendation
**Deploy first with Phase 5A/5B, then add Phase 6 HIGH-priority features based on wife's feedback.** This gets a working product live and lets you iterate based on real usage.

---

## Part 5: Known Issues & Fixes

### Issue 1: $0 Price Display (Fixed ✅)
**Problem**: Some products showed `$0.00` for King Soopers or Amazon prices.  
**Root Cause**: Kroger API sometimes nests prices under `fulfillment.curbside.price` or `fulfillment.delivery.price` if the main `price` field is missing. SerpApi uses `price.extracted_value` for extracted prices.  
**Fix Applied**:
- `lib/kroger/products.ts`: Added fallback extraction logic for `fulfillment.delivery.price` and other nested fields
- `lib/amazon/products.ts`: Added check for `price.extracted_value` and flexible parsing
- `lib/comparison/engine.ts`: Ignore `$0` prices in winner calculation

### Issue 2: Product Picker Location Bug (Fixed ✅)
**Problem**: When picking a product in /pick/[itemId], the search was hardcoded to store `02900520` instead of the user's configured location.  
**Fix Applied**: Updated product picker to pull user's location from app_settings before searching.

### Issue 3: Todoist Sync Not Working (Fixed ✅)
**Problem**: Todoist API v2 endpoint changed (v3 is deprecated).  
**Fix Applied**: Migrated to official `@doist/todoist-api-typescript` package. Updated `/api/todoist/sync` to use correct v2 endpoint.

---

## Part 6: Local Development Setup

### Prerequisites
- Node.js 18+ (recommended: 20+)
- npm 10+
- Supabase account (free tier OK)
- Todoist account with API token
- Kroger developer account (free)
- SerpApi account (free tier: 100 searches/month)

### Quick Start

```bash
# 1. Clone/navigate to project
cd /Users/justin.floyd/ws/groceries

# 2. Install dependencies
npm install

# 3. Fill in .env.local with your credentials
# (File already exists with template; just add values)
cat .env.local  # verify template
# Then edit: TODOIST_API_TOKEN, KROGER_CLIENT_ID, etc.

# 4. Start dev server
npm run dev

# 5. Open browser
open http://localhost:3000
```

### Key Files to Know
| File | Purpose |
|------|---------|
| `.env.local` | All API credentials (git-ignored) |
| `next.config.ts` | Next.js config (standalone output for Cloud Run) |
| `tsconfig.json` | TypeScript strict mode enabled |
| `types/index.ts` | All shared TypeScript interfaces |
| `lib/todoist/client.ts` | Todoist API wrapper |
| `lib/kroger/auth.ts` | Kroger OAuth flows |
| `lib/matching/preferences.ts` | Load/save product preferences to Supabase |
| `supabase/schema.sql` | Database structure + seed data |

---

## Part 7: Testing Checklist

### Manual End-to-End Flow (Before Deployment)

- [ ] **List Management**
  - [ ] Add item via text input (e.g., "milk")
  - [ ] Item appears in list with normalized name
  - [ ] Can delete item from list
  - [ ] Sync button fetches from Todoist "groceries" project
  - [ ] Todoist items appear with `source: todoist`

- [ ] **New Item Workflow**
  - [ ] Add "oreos" (new item, no preference)
  - [ ] Click Compare → see "⚠️ NEEDS PICK" warning
  - [ ] Click "Change KS ▼" → product picker loads
  - [ ] Select a specific Oreo product → saves preference
  - [ ] Back on Compare → item now shows both prices
  - [ ] Winner is highlighted (lower price wins)

- [ ] **Price Comparison**
  - [ ] All items show float prices > $0
  - [ ] Total savings calculated correctly (absolute difference between stores)
  - [ ] "Savings" is positive when one store is cheaper than the other
  - [ ] Winner is highlighted (lower price wins, regardless of store)

- [ ] **Settings**
  - [ ] Edit zip code → updates in database
  - [ ] Edit Kroger location ID → used in next search
  - [ ] Sign in with King Soopers → redirects to OAuth
  - [ ] Callback stores token → "Signed in as [user]" displays

- [ ] **Cart Push**
  - [ ] Compare page shows "🛒 Add to KS Cart (X items)"
  - [ ] Click button → calls /api/kroger/cart
  - [ ] No errors in console or server logs
  - [ ] Log into kingsoopers.com manually → items in cart

### API Endpoint Checks

```bash
# Todoist sync
curl -s http://localhost:3000/api/todoist/sync | jq .

# Add a list item
curl -X POST http://localhost:3000/api/list \
  -H 'Content-Type: application/json' \
  -d '{"items":["milk"]}' | jq .

# Compare (requires TOKEN and LOCATION in settings)
curl -s 'http://localhost:3000/api/compare?search=milk' | jq .

# Settings
curl -s http://localhost:3000/api/settings | jq .
```

---

## Part 8: Deployment Guide (Phase 5B)

### Option A: Docker Locally

```bash
# Build Docker image
docker build -t sgo:latest .

# Run container locally
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL="your-url" \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY="your-key" \
  -e TODOIST_API_TOKEN="your-token" \
  -e KROGER_CLIENT_ID="your-id" \
  -e KROGER_CLIENT_SECRET="your-secret" \
  -e SERPAPI_API_KEY="your-key" \
  sgo:latest
```

### Option B: Google Cloud Run (Recommended)

1. **Prerequisite**: gcloud CLI installed & authenticated
   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```

2. **Create Cloud Run service**
   ```bash
   gcloud run deploy smart-grocery-optimizer \
     --source . \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars NEXT_PUBLIC_SUPABASE_URL=... \
     # (All env vars listed here)
   ```

3. **Use Google Cloud Secret Manager instead** (Recommended for secrets)
   ```bash
   # Create secrets
   echo -n "your_token" | gcloud secrets create TODOIST_API_TOKEN --data-file=-
   
   # Grant Cloud Run service account access
   gcloud secrets add-iam-policy-binding TODOIST_API_TOKEN \
     --member=serviceAccount:YOUR-SA@appspot.gserviceaccount.com \
     --role=roles/secretmanager.secretAccessor
   
   # Update Cloud Run to use Secret Manager
   gcloud run services update smart-grocery-optimizer \
     --update-secrets TODOIST_API_TOKEN=TODOIST_API_TOKEN:latest
   ```

4. **Verify deployment**
   ```bash
   gcloud run services describe smart-grocery-optimizer --region us-central1
   # (Will show service URL like https://smart-grocery-optimizer-xxxxx.a.run.app)
   ```

5. **Update Kroger OAuth Callback URL**
   - Go to developer.kroger.com → App Settings
   - Update redirect URI to: `https://smart-grocery-optimizer-xxxxx.a.run.app/api/kroger/auth/callback`

---

## Part 9: Workspace Setup for Copilot

This project uses the following conventions:

### Testing
- Run `npm run dev` to start the Next.js dev server (http://localhost:3000)
- Manual end-to-end testing (see Testing Checklist in Part 7)
- No automated test suite yet (📌 potential Phase 6 addition)

### Build & Run
- **Development**: `npm run dev` (watches for changes)
- **Production Build**: `npm run build` (outputs to .next/ folder)
- **Lint**: `npm run lint` (ESLint check)
- **Type Check**: `npx tsc --noEmit` (TypeScript strict mode)

### Code Style
- TypeScript strict mode enabled
- Prefer `const` and `let` (no `var`)
- API route handlers: server-side logic, keep secrets hidden
- Components: functional, use hooks
- DB queries: use Supabase client (never hardcode credentials)

### Common Pitfalls
1. **`.env.local` mismatch**: If API calls fail with 401/403, check that keys match services
2. **Kroger location ID bug**: Always pull from `app_settings` before searching (not hardcoded)
3. **SerpApi free tier**: 100 searches/month → cache results if possible
4. **Todoist token expiry**: Token is long-lived, but check if subscription is active
5. **Supabase RLS**: Currently disabled (public read/write). Plan to add RLS in Phase 6.

### Project Structure
```
/app              - Next.js pages & API routes
/lib              - Reusable logic (API clients, matching, comparison)
/components       - React components (dashboard UI, forms)
/public           - Static assets
/supabase         - DB schema + seed data
/types            - TypeScript interfaces
/.env.local       - Credentials (git-ignored)
```

---

## Part 10: Approval & Next Steps

### What is This Plan?
This document describes the current state of the Smart Grocery Optimizer project and outlines the path to full deployment.

### What Needs Your Approval?
1. **Phase 5A** (QA & bug fixes): Is the testing checklist comprehensive?
2. **Phase 5B** (Deployment): Should we use Google Cloud Run, or another platform?
3. **Phase 6+** (Future): Which features matter most (responsiveness, analytics, caching)?

### How to Proceed
- ✅ **Approve the plan** → I'll proceed with Phase 5A testing & Phase 5B deployment
- 🤔 **Request changes** → Tell me what needs adjustment (features, timeline, approach)
- ❓ **Ask questions** → Unclear on any part? I'll clarify

**Please review and let me know your approval and any requested changes.**

---

## Appendix: Service Credentials Checklist

Before I start building/testing, confirm you have:

| Service | Where to Get | Need Approx Time |
|---------|--------------|------------------|
| **Todoist API Token** | Settings → Integrations → Developer → "API token" | 2 min |
| **Kroger Client ID/Secret** | developer.kroger.com → Register App (Production) | 5 min |
| **SerpApi Key** | serpapi.com → Dashboard → Copy "API key" | 2 min |
| **Supabase URL & Anon Key** | supabase.com → Project → Settings → API | 2 min |
| **Kroger Location ID** | kingsoopers.com/stores/... or /api/kroger/locations?zip=80516 | 3 min |

Once confirmed in `.env.local`, reply and I'll start Phase 5A testing.

---

**End of Implementation Plan v3**
