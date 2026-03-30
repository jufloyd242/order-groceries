# GitHub Copilot Instructions — Smart Grocery Optimizer

**Project**: Smart Grocery Optimizer (SGO)  
**Stack**: Next.js 16 + TypeScript + Supabase + React 19  
**Status**: Phase 4 Complete (Cart Push) | Phase 5 In Progress (QA + Deployment)  
**Owner**: Justin Floyd | **Primary User**: Wife (designed for simplicity/speed)

---

## 1. Project Overview

**What it does**: Compares grocery prices between King Soopers and Amazon in real-time. Syncs a Todoist shopping list, searches both stores in parallel, and lets users push items to the winning store's cart with one click.

**Why it exists**: Automate manual grocery price comparison to save time (~40 min → 5 min) and money.

**Key workflow**: 
```
Todoist/Manual Input → Normalize → Search Kroger + Amazon (parallel) 
→ Fuzzy match → Price compare → Dashboard → Pick product → Push to cart
```

**Live endpoints** (dev server):
- `http://localhost:3000` — Main app
- `http://localhost:3000/compare` — Price dashboard
- `http://localhost:3000/pick/[itemId]` — Product picker
- `http://localhost:3000/settings` — Location config & Kroger login

---

## 2. Quick Start

```bash
cd /Users/justin.floyd/ws/groceries
npm install                    # If needed
npm run dev                    # Start dev server (http://localhost:3000)
npm run build && npm start     # Test production build locally
npm run lint                   # Type check + linting
npx tsc --noEmit              # TypeScript strict mode check
```

**Local Database**: Supabase (cloud-hosted PostgreSQL)  
**Credentials**: `.env.local` (git-ignored, template provided with comments)

---

## 3. Architecture at a Glance

### Client-Side (`/app` routes)
| Route | Purpose | Status |
|-------|---------|--------|
| `/` | Home: add/view items | ✅ Complete |
| `/compare` | Price dashboard | ✅ Complete |
| `/pick/[itemId]` | Product picker (fuzzy search, brand selection) | ✅ Complete |
| `/settings` | Zip code, location ID, Kroger login | ✅ Complete |

### Server-Side APIs (`/app/api`)
| Endpoint | Purpose | Status |
|----------|---------|--------|
| `/list` | GET/POST list items | ✅ Complete |
| `/todoist/sync` | Fetch from Todoist | ✅ Complete |
| `/compare` | Multi-store price comparison | ✅ Complete |
| `/preferences` | GET/POST product mappings | ✅ Complete |
| `/kroger/products` | Search King Soopers | ✅ Complete |
| `/kroger/locations` | Find stores by zip | ✅ Complete |
| `/kroger/cart` | Push to King Soopers cart | ✅ Complete |
| `/kroger/auth/authorize` | OAuth redirect | ✅ Complete |
| `/kroger/auth/callback` | OAuth token storage | ✅ Complete |
| `/amazon/products` | Search Amazon (SerpApi) | ✅ Complete |
| `/settings` | Get/update app config | ✅ Complete |

### Libraries (`/lib`)
| Module | Purpose |
|--------|---------|
| `/todoist` | Todoist API client (fetch projects, tasks) |
| `/kroger` | Kroger products, auth, OAuth token manage, cart push |
| `/amazon` | SerpApi Amazon search wrapper |
| `/matching` | Normalize text, fuzzy match (Fuse.js), product prefs |
| `/comparison` | Unit conversion, price calc, winner selection |
| `/supabase` | DB client (browser + server-side) |

### Database (`/supabase/schema.sql`)
| Table | Purpose |
|-------|---------|
| `list_items` | Shopping list entries |
| `product_preferences` | "Learn once, remember forever" mappings |
| `price_history` | Track price trends (seeded, not yet used in UI) |
| `abbreviations` | tp → toilet paper, etc. (seeded) |
| `app_settings` | Config + Kroger OAuth tokens |

---

## 4. Common Workflows

### Adding a Feature
1. **Read the implementation plan** (IMPLEMENTATION_PLAN.md) to understand current phase & blockers
2. **Check types/** first — all interfaces are in `types/index.ts`
3. **Understand the data flow** — request → API route → lib function → DB/external API → response
4. **Keep secrets server-side** — API tokens never exposed to frontend
5. **Test with curl** before updating UI (example below in Testing)

### Fixing a Bug
1. **Check known issues** (IMPLEMENTATION_PLAN.md, Part 5) — might be already identified
2. **Search the codebase** for related logic — start with grep or semantic search
3. **Look at error logs** — check browser console and terminal output
4. **Isolate via API test** — Is the bug in the API or component? Test API directly with curl
5. **Update tests** if you add a fix

### Testing Locally
```bash
# Test an API endpoint directly
curl -s http://localhost:3000/api/list | jq .

# Test with data
curl -X POST http://localhost:3000/api/list \
  -H 'Content-Type: application/json' \
  -d '{"items":[{"raw_text":"milk"}]}' | jq .

# Check types
npx tsc --noEmit

# Rebuild if you change .env.local
npm run dev  # (dev server auto-restarts)
```

---

## 5. Code Style & Conventions

### TypeScript
- **Strict mode enabled** (tsconfig.json) — must type everything
- **Interfaces in types/index.ts** — don't repeat types in multiple files
- **Error handling** — use try-catch, return { error: string } in API responses
- **No `any` type** — use unknowns or generics if you must

### API Routes
```typescript
// /app/api/[route]/route.ts pattern:
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Validate input from query params or headers
    const param = request.nextUrl.searchParams.get('param');
    if (!param) {
      return NextResponse.json({ error: 'Missing param' }, { status: 400 });
    }
    
    // Call lib function (keep secrets here, not in frontend)
    const result = await someLibFunction(param);
    
    // Return JSON
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

### Database Queries
```typescript
// Always use Supabase client (never hardcode DB URL)
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(url, key); // From env

// Example query
const { data, error } = await supabase
  .from('list_items')
  .select('*')
  .eq('status', 'pending');

if (error) throw new Error(error.message);
```

### Components
- Use functional components with hooks
- Lift state to the route component (not deeply nested)
- Props: keep interfaces in types/index.ts
- For async data: use API routes, not direct DB access from components

### Naming
- `camelCase` for variables/functions
- `PascalCase` for React components & TypeScript interfaces
- Descriptors: `mapXYZ` for transformations, `isXYZ` for booleans, `fetchXYZ` for async

---

## 6. Current Blockers & Known Issues

### ✅ Fixed Issues
1. **$0 price display** — Added fallback extraction for Kroger `fulfillment.delivery.price` and SerpApi `price.extracted_value`
2. **Product picker location bug** — Now pulls user's location from `app_settings` before searching
3. **Todoist API v2 migration** — Switched to official `@doist/todoist-api-typescript` package

### ⏳ In Progress (Phase 5A)
- [ ] End-to-end testing (add item → search → compare → pick → push)
- [ ] Edge case handling (out of stock, region restrictions)
- [ ] Error messages on UI (explain why product wasn't found)

### 🔲 Future Phases
- **Phase 5B**: Deployment (Docker + Google Cloud Run)
- **Phase 6**: Polish (mobile responsive, loading states, toasts)
- **Phase 7**: Analytics (price history trends, savings leaderboard)

---

## 7. Important Files to Know

| File | Purpose | Edit Frequency |
|------|---------|-----------------|
| `IMPLEMENTATION_PLAN.md` | Master plan (read before major changes) | Rarely |
| `.env.local` | Credentials (git-ignored) | Once (setup) |
| `types/index.ts` | All interfaces | Often (when adding features) |
| `lib/matching/preferences.ts` | Save/load product mappings | Sometimes |
| `lib/comparison/engine.ts` | Price logic & unit conversion | Sometimes |
| `lib/kroger/products.ts` | Kroger search + price extraction | Sometimes |
| `lib/amazon/products.ts` | Amazon search + price extraction | Sometimes |
| `app/compare/page.tsx` | Main dashboard UI | Often |
| `supabase/schema.sql` | DB schema | Rarely (data migrations) |

---

## 8. Environment Variables

**Template in `.env.local`:**
```bash
# Todoist (get from Settings → Integrations → Developer)
TODOIST_API_TOKEN=your_token

# Kroger (get from developer.kroger.com)
KROGER_CLIENT_ID=your_id
KROGER_CLIENT_SECRET=your_secret

# SerpApi (get from serpapi.com)
SERPAPI_API_KEY=your_key

# Supabase (get from supabase.com project settings)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key

# App config (defaults provided)
DEFAULT_ZIP_CODE=80516
DEFAULT_STORE_CHAIN=King Soopers
TODOIST_PROJECT_NAME=groceries
```

**Important**: Restart dev server after updating `.env.local`.

---

## 9. Testing Checklist Before Deployment

See **IMPLEMENTATION_PLAN.md, Part 7** for full testing checklist. Quick version:

- [ ] Add item manually → appears in list
- [ ] Sync Todoist → items appear with `source: todoist`
- [ ] Compare → both stores show prices > $0
- [ ] Pick product for new item → preference saved
- [ ] Click "Add to KS Cart" → no console errors
- [ ] Log into kingsoopers.com → items in cart

---

## 10. Deployment Checklist (Phase 5B)

1. **Docker**: `docker build -t sgo:latest . && docker run -p 3000:3000 sgo:latest`
2. **Google Cloud**: `gcloud run deploy smart-grocery-optimizer --source .`
3. **Secrets**: Use Google Cloud Secret Manager, not hardcoded env vars
4. **Kroger OAuth callback**: Update URL to `https://[GCP-domain]/api/kroger/auth/callback`
5. **Test on GCP**: Verify endpoints work from production URL

---

## 11. Asking Copilot for Help

### Good Questions
- "Why are prices showing $0 for some products?"
- "How do I add a new field to the list_items table?"
- "What's the difference between the /compare and /pick APIs?"
- "How should I add error handling to this API route?"

### Poor Questions
- "Fix all the bugs" (too vague — which ones?)
- "Make this faster" (premature optimization — profile first)
- "Refactor everything" (scope creep — focus on one area)

### Always Include
- The error message (full stack trace if available)
- Which endpoint/component is failing
- Steps to reproduce the issue
- What you've already tried

---

## 12. Links & Resources

**Project Documentation**
- [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) — Master plan (v3)
- [Smart Grocery Optimizer Implementation.md](./Smart%20Grocery%20Optimizer%20Implementation.md) — Chat history (for context)
- [Fixing File Write Issues.md](./Fixing%20File%20Write%20Issues.md) — Bug fixes (for context)

**External APIs**
- [Todoist API v2 Docs](https://developer.todoist.com/rest/v2)
- [Kroger Developer Portal](https://developer.kroger.com)
- [SerpApi Documentation](https://serpapi.com/docs)
- [Supabase Docs](https://supabase.com/docs)

**Technology Docs**
- [Next.js 16 Docs](https://nextjs.org/docs)
- [React 19 Docs](https://react.dev)
- [TypeScript Docs](https://www.typescriptlang.org/docs)
- [Fuse.js (fuzzy search)](https://fusejs.io/)

---

## 13. Contact & Escalation

- **Main Decision Maker**: Justin Floyd
- **Primary User**: Wife (UX feedback)
- **Deployment Target**: Google Cloud Run
- **Budget**: Minimal (free tiers preferred)

---

**Last Updated**: March 29, 2026  
**Next Review**: After Phase 5A testing completes
