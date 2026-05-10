# Smart Grocery Optimizer

Compare grocery prices between King Soopers and Amazon in real-time. Syncs a Todoist shopping list, searches both stores in parallel, fuzzy-matches products, and lets you push items to the winning store's cart with one click.

## Monorepo Structure

```
groceries/
├── app/                    # Next.js 16 web app (routes + API)
│   ├── api/                #   REST API routes (all business logic)
│   ├── compare/            #   Price comparison dashboard
│   ├── pick/[itemId]/      #   Product picker per item
│   ├── search/             #   Manual product search
│   ├── settings/           #   Location config & Kroger login
│   └── login/              #   Supabase auth
├── components/             # React UI components
├── ios/                    # Native iOS app (SwiftUI)
│   └── SmartGroceryOptimizer/
├── lib/                    # Shared server-side logic
│   ├── amazon/             #   SerpApi Amazon search
│   ├── cart/               #   Cart context & store services
│   ├── comparison/         #   Price engine & unit conversion
│   ├── kroger/             #   Kroger products, auth, OAuth, cart
│   ├── matching/           #   Normalize text, fuzzy match (Fuse.js)
│   ├── supabase/           #   DB clients (browser + server)
│   └── todoist/            #   Todoist API client
├── types/                  # Shared TypeScript interfaces
│   └── index.ts            #   All types (mirrored as Swift Codable structs in ios/)
├── supabase/               # DB schema & migrations
├── tests/                  # E2E & manual test checklists
├── .env.local              # Credentials (git-ignored)
└── IMPLEMENTATION_PLAN.md  # Master project plan
```

## Architecture

```
┌──────────────────────────────────────────────┐
│  Clients                                     │
│  ┌─────────────┐    ┌─────────────────────┐  │
│  │ Web (Next.js│    │ iOS (SwiftUI)       │  │
│  │ React 19)   │    │ URLSession + Supabase│ │
│  └──────┬──────┘    └──────────┬──────────┘  │
└─────────┼──────────────────────┼─────────────┘
          │      HTTP / JSON     │
          ▼                      ▼
┌──────────────────────────────────────────────┐
│  API Layer  (/app/api/*)                     │
│  Next.js 16 Route Handlers                   │
│  Auth: Supabase JWT (middleware.ts)          │
│  RLS: Row-level security per user            │
└──────────┬───────────────────────────────────┘
           │
     ┌─────┴──────┐
     ▼            ▼
┌──────────┐  ┌──────────────────┐
│ Supabase │  │ External APIs    │
│ (Postgres│  │ ├─ Kroger        │
│  + Auth) │  │ ├─ Amazon/SerpApi│
└──────────┘  │ └─ Todoist       │
              └──────────────────┘
```

Both clients call the same `/api/*` routes — all business logic, auth, and data access live on the server.

## Quick Start

### Web App

```bash
npm install
npm run dev          # http://localhost:3000
```

### iOS App

Open `ios/SmartGroceryOptimizer.xcodeproj` in Xcode 16+. Set the scheme to a simulator or device, then run.

> **Local network**: The simulator uses `localhost:3000`. A physical device must use your Mac's local IP (e.g. `192.168.x.x:3000`). The iOS app auto-detects this via a build configuration toggle.

### Environment

Copy `.env.local.example` (or see `.github/copilot-instructions.md`) and fill in:

| Variable | Source |
|----------|--------|
| `TODOIST_API_TOKEN` | Todoist Settings → Integrations → Developer |
| `KROGER_CLIENT_ID` / `SECRET` | developer.kroger.com |
| `SERPAPI_API_KEY` | serpapi.com |
| `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` | Supabase project settings |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project settings (server-only) |

Restart the dev server after changes.

## API Overview

All routes require a valid Supabase JWT. Responses use `{ success: boolean, error?: string, ...data }`.

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/list` | GET / POST | Shopping list CRUD |
| `/api/compare` | GET | Multi-store price comparison |
| `/api/search` | GET | Manual product search |
| `/api/preferences` | GET / POST | Saved product mappings |
| `/api/settings` | GET / POST | App configuration |
| `/api/cart/submit` | POST | Push cart to Kroger |
| `/api/kroger/products` | GET | Search King Soopers |
| `/api/kroger/locations` | GET | Find stores by zip |
| `/api/kroger/auth/*` | GET | OAuth2 flow for cart access |
| `/api/amazon/products` | GET | Search Amazon (SerpApi) |
| `/api/todoist/sync` | GET | Pull Todoist grocery tasks |
| `/api/abbreviations` | GET / POST | Abbreviation dictionary |

See [`.github/copilot-instructions.md`](.github/copilot-instructions.md) for full request/response contracts.

## Development

```bash
npm run lint         # ESLint + type check
npx tsc --noEmit     # TypeScript strict mode
npm run build        # Production build
```

## Documentation

- [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) — Master plan & phase tracking
- [`.github/copilot-instructions.md`](.github/copilot-instructions.md) — Detailed API contracts, code conventions, architecture
