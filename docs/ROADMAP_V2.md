# Bartr — Launch Roadmap v2

> Last updated: 2026-02-26

## What's Blocking Launch?

The backend API is feature-complete with ~84 tests. Every endpoint works. But **there is no usable frontend** — just a "coming soon" page and a donation page. A user visiting the site today cannot register, browse listings, message anyone, or make a trade. Beyond the UI gap, there are security holes (fake encryption, no admin gating) and operational gaps (placeholder addresses, third-party privacy leaks).

Below is everything that needs to happen, broken into the smallest useful tasks.

---

## How to Build the Frontend — Technology Context

### Current Stack
- **Next.js 14** (App Router) + **React 18** + **Tailwind CSS 3** — already installed
- No component library, no API client, no form library, no state management

### Modern Approach: What to Add

**UI Components — two paths:**

| Approach | What It Is | Tradeoffs |
|---|---|---|
| **shadcn/ui** (recommended) | Copy-paste component primitives built on Radix UI. You own the code, full control. Not a dependency — generates files into your project. | Need to init and pick components. Tailwind-native. Very popular in 2025-2026. |
| **Hand-rolled Tailwind** | Build every button, card, input, modal from scratch with Tailwind classes. | Full control, zero deps. Slower to build, harder to keep consistent. |
| **Headless libraries (Radix, Ark, Headless UI)** | Unstyled accessible primitives — you add Tailwind styling on top. | Middle ground. More work than shadcn, less than hand-rolled. |
| **Full component libraries (Mantine, Chakra, daisyUI)** | Pre-styled, opinionated components. | Fast to prototype. Harder to customize deeply. Can conflict with Tailwind. |

**Data Fetching:**

| Library | Why |
|---|---|
| **TanStack React Query** | Cache, refetch, pagination, optimistic updates — the standard for REST APIs in React. Handles loading/error states. |
| **SWR** | Lighter alternative by Vercel. Less features but simpler API. |
| **Plain fetch** | No caching, no dedup, manual loading states. Fine for one-off calls, painful at scale. |

**Forms:**

| Library | Why |
|---|---|
| **React Hook Form + Zod** | Performant forms with schema validation. Zod schemas can be shared with the API. |
| **Formik** | Older, heavier. Still works but React Hook Form is the modern default. |

**Auth State:**
- Store JWT `access_token` in memory (React context/state), `refresh_token` in an httpOnly cookie (already how the API works).
- Wrap the app in an `AuthProvider` that calls `/auth/me` on mount, handles token refresh transparently.
- Next.js middleware can protect routes server-side.

**Design System:**
- Define Tailwind theme tokens (colors, spacing, typography) in `tailwind.config.ts`.
- Build a small set of base components (Button, Input, Card, Badge, Modal, Avatar) that everything else composes from.

**Recommended stack addition for Bartr:**
```
shadcn/ui (components) + React Query (data) + React Hook Form + Zod (forms) + next-themes (dark mode)
```
This is the most common modern Next.js stack in 2025-2026 and has excellent docs, community support, and Tailwind integration.

---

## Phase 5: Frontend Foundation

Everything the UI needs before any pages can be built.

### 5.1 — Install frontend dependencies
- [ ] Add `@tanstack/react-query` + `@tanstack/react-query-devtools`
- [ ] Add `react-hook-form` + `@hookform/resolvers` + `zod`
- [ ] Init `shadcn/ui` (runs `npx shadcn@latest init`, creates `components/ui/` dir, updates tailwind config)
- [ ] Add `next-themes` for dark/light mode support
- [ ] Add `lucide-react` for icons (comes with shadcn but list explicitly)

### 5.2 — Design tokens & Tailwind theme
- [ ] Define color palette in `tailwind.config.ts` — primary, secondary, accent, destructive, muted, background, foreground, card, border colors (CSS variables approach for theme switching)
- [ ] Define typography scale — font family (Inter or similar), sizes, weights
- [ ] Define spacing/radius tokens for consistency
- [ ] Add `@tailwindcss/typography` plugin for prose content (listing descriptions)

### 5.3 — Base UI components (via shadcn/ui)
- [ ] Generate: Button, Input, Textarea, Label, Card, Badge, Avatar, Dialog (modal), Dropdown Menu, Select, Separator, Skeleton (loading placeholder), Toast/Sonner (notifications), Tooltip
- [ ] Create custom `Logo` component (text-based or SVG)
- [ ] Create custom `PageContainer` layout wrapper (max-width, padding)
- [ ] Create custom `EmptyState` component (icon + message + optional CTA)

### 5.4 — API client layer
- [ ] Create `packages/web/src/lib/api.ts` — base fetch wrapper with:
  - Base URL from env var (`NEXT_PUBLIC_API_URL`)
  - Auto-attach `Authorization: Bearer <token>` header
  - Auto-refresh token on 401 response (call `/auth/refresh`, retry original request)
  - JSON parsing, error extraction
- [ ] Create typed API functions per domain:
  - `lib/api/auth.ts` — `googleLogin()`, `register()`, `refresh()`, `logout()`, `getMe()`
  - `lib/api/listings.ts` — `getListings()`, `getListing()`, `createListing()`, `updateListing()`, `deleteListing()`, `uploadImage()`, `deleteImage()`, `getCategories()`
  - `lib/api/trades.ts` — `getTrades()`, `getTrade()`, `createOffer()`, `acceptTrade()`, `declineTrade()`, `cancelTrade()`, `completeTrade()`, `rateTrade()`
  - `lib/api/users.ts` — `getUser()`, `updateProfile()`, `uploadAvatar()`, `getUserRatings()`
  - `lib/api/messages.ts` — `getThreads()`, `createThread()`, `getMessages()`, `sendMessage()`
  - `lib/api/moderation.ts` — `submitFlag()`, `getMyFlags()`, `getAdminFlags()`, `updateFlag()`, `checkText()`

### 5.5 — Auth provider & session management
- [ ] Create `AuthContext` with React context — holds `user`, `accessToken`, `isLoading`, `isAuthenticated`
- [ ] Create `AuthProvider` component — calls `/auth/me` on mount, stores user state
- [ ] Create `useAuth()` hook — returns context values + `login()`, `logout()`, `register()` actions
- [ ] Handle token refresh logic — intercept 401s, call `/auth/refresh`, retry
- [ ] Store refresh token in httpOnly cookie (API already sets it), access token in memory only
- [ ] Create `ProtectedRoute` wrapper or Next.js middleware to redirect unauthenticated users

### 5.6 — React Query setup
- [ ] Create `QueryProvider` wrapping the app with `QueryClientProvider`
- [ ] Define query key factories per domain: `listingKeys.all`, `listingKeys.detail(id)`, etc.
- [ ] Create custom hooks per domain:
  - `useListings(filters)`, `useListing(id)`, `useCreateListing()`, `useUpdateListing()`, `useDeleteListing()`
  - `useTrades(filters)`, `useTrade(id)`, `useCreateOffer()`, `useAcceptTrade()`, etc.
  - `useUser(nickname)`, `useUpdateProfile()`, `useUserRatings(nickname)`
  - `useThreads()`, `useMessages(threadId)`, `useSendMessage()`
- [ ] Configure stale times, retry logic, error handling defaults

### 5.7 — App shell & navigation
- [ ] Create `Navbar` component:
  - Logo/home link (left)
  - Navigation links: Browse, Sell (create listing), Messages, Donate (center or left)
  - Auth section (right): Login button (when logged out) / Avatar + dropdown (when logged in)
  - Dropdown menu: Profile, My Listings, My Trades, Settings, Logout
  - Mobile hamburger menu (responsive)
- [ ] Create `Footer` component — links to donate, about/privacy page, source code
- [ ] Update `layout.tsx` to include `QueryProvider`, `AuthProvider`, `ThemeProvider`, `Navbar`, `Footer`, `Toaster`
- [ ] Set up Next.js route groups: `(public)` for open pages, `(protected)` for auth-required pages

---

## Phase 6: Authentication Pages

### 6.1 — Google OAuth login flow
- [ ] Create `/login` page — centered card with "Sign in with Google" button
- [ ] Button triggers redirect to `GET /auth/google` (API handles OAuth redirect)
- [ ] Style the page — logo, tagline, privacy note ("we only store your nickname")

### 6.2 — OAuth callback handler
- [ ] Create `/auth/callback` page — receives `access_token` + `refresh_token` from URL params
- [ ] Store tokens, call `/auth/me`, redirect to home or previous page
- [ ] Show loading spinner during processing
- [ ] Handle error cases (invalid/expired tokens) — show error with "try again" link

### 6.3 — Registration page (new users)
- [ ] Create `/register` page — shown when Google account has no Bartr account yet
- [ ] Receives `google_id` + `email` from callback URL params
- [ ] Form fields: Nickname (text, 3-20 chars, alphanumeric + underscores), Password (min 8 chars), Confirm Password
- [ ] Validate nickname availability (debounced check against API or on submit)
- [ ] Submit calls `POST /auth/register` → store tokens → redirect to home
- [ ] Show validation errors inline (nickname taken, password too short, passwords don't match)

### 6.4 — Logout flow
- [ ] Logout button in navbar dropdown calls `POST /auth/logout` with refresh token
- [ ] Clear auth state (context + any stored tokens)
- [ ] Redirect to home page
- [ ] Show toast: "You've been logged out"

---

## Phase 7: Listings — The Billboard

This is the core of the marketplace. Users need to browse, search, view, create, and manage listings.

### 7.1 — Browse listings page (`/listings` or `/`)
- [ ] Create the main listings page — grid/list of listing cards
- [ ] Listing card component: title, price indication, payment method badges, seller nickname + reputation tier badge, first image thumbnail (or placeholder), time ago
- [ ] Pagination — "Load more" button or infinite scroll (React Query `useInfiniteQuery`)
- [ ] Empty state when no listings match

### 7.2 — Search & filter bar
- [ ] Search input with debounced full-text search (`?q=`)
- [ ] Category filter dropdown (fetches from `GET /categories`)
- [ ] Payment method filter (multi-select: BTC, XMR, Cash, Bank, etc.)
- [ ] Status filter (active only by default, optionally show sold/expired)
- [ ] Sort options: newest, oldest, price (if applicable)
- [ ] URL-synced filters (filters reflected in URL query params so links are shareable)

### 7.3 — Listing detail page (`/listings/[id]`)
- [ ] Full listing view: title, description (rendered as prose), price, payment methods, category breadcrumb
- [ ] Image gallery — show all images, click to enlarge (lightbox/modal)
- [ ] Seller info sidebar: avatar, nickname, reputation score + tier badge, member since, link to profile
- [ ] Action buttons (if not own listing): "Message Seller", "Make Offer" (creates trade)
- [ ] Action buttons (if own listing): "Edit", "Delete" (with confirmation dialog)
- [ ] Related listings section (same category) — nice to have, not blocking

### 7.4 — Create listing page (`/listings/new`)
- [ ] Protected route (must be logged in)
- [ ] Form: Title, Description (textarea or rich-text), Category (select from tree), Payment Methods (multi-select checkboxes), Price Indication (optional text, e.g. "0.005 BTC"), Currency (optional select)
- [ ] Image upload: drag-and-drop zone or file picker, up to 5 images, show previews
- [ ] Preview mode — see how the listing will look before publishing
- [ ] Submit → `POST /listings` → upload images → redirect to the new listing page
- [ ] Validation: title required (5-200 chars), description required (20-5000 chars), at least one payment method

### 7.5 — Edit listing page (`/listings/[id]/edit`)
- [ ] Protected route (must be listing owner)
- [ ] Same form as create, pre-filled with existing data
- [ ] Image management: show existing images with delete button, add new images (up to max 5 total)
- [ ] Submit → `PUT /listings/:id` + image uploads/deletes → redirect to listing page
- [ ] Option to mark listing as sold/expired (status change)

### 7.6 — My listings page (`/dashboard/listings`)
- [ ] Protected route
- [ ] Table/list of user's own listings with status badges (active, sold, expired)
- [ ] Quick actions: edit, delete, mark as sold
- [ ] Filter by status
- [ ] Empty state with CTA to create first listing

---

## Phase 8: User Profiles

### 8.1 — Public profile page (`/user/[nickname]`)
- [ ] Avatar (or placeholder), nickname, bio, member since, last active
- [ ] Reputation section: composite score (visual bar/ring), tier badge, trade count
- [ ] Rating breakdown: average stars, total ratings count
- [ ] Recent ratings list (paginated, from `GET /users/:nickname/ratings`)
- [ ] Active listings by this user (from `GET /listings?user_id=...`)
- [ ] "Message User" button (if logged in and not own profile)

### 8.2 — Edit profile page (`/settings/profile`)
- [ ] Protected route
- [ ] Form: Nickname (with availability check), Bio (textarea, max 500 chars)
- [ ] Avatar upload: current avatar preview, click to change, crop/resize before upload
- [ ] Submit → `PUT /users/me` + avatar upload → show toast

### 8.3 — User reputation display components
- [ ] `ReputationBadge` — small inline badge showing tier (New/Verified/Trusted/Elite) with color coding
- [ ] `ReputationScore` — larger display with composite score number, tier, and breakdown bars
- [ ] `StarRating` — 1-5 stars display (static for showing ratings, interactive for submitting)
- [ ] `RatingCard` — individual rating display: rater nickname, stars, comment, date

---

## Phase 9: Trade Flow

### 9.1 — Trade initiation
- [ ] "Make Offer" button on listing detail page → calls `POST /trades` → redirect to trade page
- [ ] Confirmation dialog before creating offer: "You're offering to trade for [listing title] with [seller]"

### 9.2 — Trade detail page (`/trades/[id]`)
- [ ] Protected route (only trade participants can view)
- [ ] Trade status header: big status badge (Offered → Accepted → Completed / Declined / Cancelled)
- [ ] Listing summary card (what's being traded)
- [ ] Both parties shown: buyer and seller with avatars + reputation badges
- [ ] Action buttons based on state and role:
  - Seller sees: Accept / Decline (when status = offered)
  - Buyer sees: Cancel (when status = offered or accepted)
  - Both see: "Mark as Complete" (when status = accepted, shows who has confirmed)
- [ ] Trade event timeline — chronological log of all state changes with timestamps
- [ ] Link to message thread with the other party

### 9.3 — My trades dashboard (`/dashboard/trades`)
- [ ] Protected route
- [ ] Tab or filter by role: "Buying" / "Selling" / "All"
- [ ] Filter by status: Active (offered + accepted), Completed, Cancelled/Declined
- [ ] Trade list items: listing title, counterparty, status badge, last event date
- [ ] Empty states per tab

### 9.4 — Rate trade flow
- [ ] After a trade is completed, show "Rate this trade" prompt on the trade detail page
- [ ] Rating form: star selector (1-5) + optional comment textarea
- [ ] Submit → `POST /trades/:tradeId/rate` → show thank you, update trade page
- [ ] Show existing rating if already rated
- [ ] Indicate if counterparty has rated you (without revealing their score)

---

## Phase 10: Messaging

### 10.1 — Inbox page (`/messages`)
- [ ] Protected route
- [ ] Thread list: other party's avatar + nickname, listing title (if linked), last message preview (truncated), timestamp, unread indicator (stretch goal)
- [ ] Sorted by most recent message
- [ ] Empty state: "No messages yet — start a conversation from a listing page"

### 10.2 — Thread view (`/messages/[threadId]`)
- [ ] Protected route (only thread participants)
- [ ] Message bubbles: own messages right-aligned, other party left-aligned
- [ ] Each message: body text, timestamp, sender avatar
- [ ] Message input at bottom: textarea + send button, enter to send (shift+enter for newline)
- [ ] Auto-scroll to bottom on new messages
- [ ] Listing context card at top if thread is linked to a listing
- [ ] Load older messages on scroll up (pagination)

### 10.3 — Start conversation flow
- [ ] "Message Seller" button on listing page → calls `POST /threads` with recipient + listing_id
- [ ] Redirect to the thread view
- [ ] "Message User" button on profile page → same flow without listing_id
- [ ] If thread already exists, API returns existing thread (no duplicates)

---

## Phase 11: Moderation & Reporting

### 11.1 — Report/flag flow (end user)
- [ ] "Report" button (flag icon) on: listing detail, user profile, individual messages
- [ ] Report dialog: reason selector (spam, scam, offensive, other) + optional description textarea
- [ ] Submit → `POST /flags` → toast: "Report submitted, we'll review it"
- [ ] "My Reports" page (`/dashboard/reports`) — list of submitted flags with status

### 11.2 — Admin moderation dashboard (`/admin/flags`)
- [ ] Protected route (admin only — requires admin role implementation first, see Phase 13)
- [ ] Flag queue: table with target type, target preview, reporter, reason, status, date
- [ ] Filter by status (pending, reviewed, resolved, dismissed) and type (listing, user, message)
- [ ] Click flag → detail view showing the flagged content + reporter info
- [ ] Action buttons: Mark Reviewed, Resolve, Dismiss
- [ ] Resolve actions: remove listing, warn user, ban user (stretch — requires ban system)

---

## Phase 12: Static & Informational Pages

### 12.1 — Landing page redesign
- [ ] Replace "coming soon" with actual landing page
- [ ] Hero section: tagline, search bar, CTA button ("Browse Listings" / "Start Selling")
- [ ] Featured/recent listings grid (3-6 listings)
- [ ] How it works: 3-step illustration (Post → Message → Trade)
- [ ] Trust indicators: number of listings, trades completed, users
- [ ] Footer with links

### 12.2 — About / How It Works page
- [ ] What is Bartr — mission statement (privacy-first, no KYC, community-driven)
- [ ] How trading works — step by step with icons
- [ ] Safety tips — how to trade safely P2P
- [ ] FAQ section

### 12.3 — Privacy page
- [ ] What data we collect (minimal: Google ID, nickname, hashed password)
- [ ] What we don't do (no tracking, no analytics, no data sales, EXIF stripping)
- [ ] How messages are stored
- [ ] How to delete your account (stretch — needs API endpoint)

### 12.4 — Donate page improvements
- [ ] Replace placeholder addresses with real BTC/XMR/Lightning addresses
- [ ] Generate QR codes locally (e.g. `qrcode` npm package) instead of calling `api.qrserver.com`
- [ ] Add copy-to-clipboard buttons for addresses

---

## Phase 13: Security & Backend Gaps

These are backend fixes that don't have UI tasks but are required before real users touch the system.

### 13.1 — Admin role system
- [ ] Add `role` column to `users` table (enum: `user`, `admin`), default `user`
- [ ] Create DB migration for the new column
- [ ] Create `requireAdmin` Fastify hook/middleware — checks `user.role === 'admin'`
- [ ] Gate `GET /admin/flags` and `PUT /admin/flags/:id` behind `requireAdmin`
- [ ] Seed initial admin user (by nickname or Google ID, via env var or migration)

### 13.2 — Message encryption (real)
- [ ] Choose encryption approach: server-side AES-256-GCM (simpler) or client-side E2E (harder, better privacy)
- [ ] For server-side: generate per-thread encryption key, encrypt message body before DB insert, decrypt on read
- [ ] Store encryption key securely (env-based master key + per-thread derived key)
- [ ] Migrate existing plaintext messages (if any exist in production)
- [ ] Update message API to handle encrypted payloads

### 13.3 — Email encryption (real)
- [ ] Encrypt `email_encrypted` column with AES-256-GCM using a server-side key
- [ ] Only decrypt when needed (e.g. sending notifications — if ever)
- [ ] Update auth registration flow to encrypt before insert

### 13.4 — Content security
- [ ] Validate and sanitize listing descriptions (prevent XSS in rendered HTML/markdown)
- [ ] Validate image uploads more strictly (magic bytes check, not just extension)
- [ ] Add EXIF stripping for uploaded images (e.g. `sharp` library — resize + strip metadata)
- [ ] Rate limit flag submissions to prevent abuse

---

## Phase 14: Polish & Launch

### 14.1 — Responsive design pass
- [ ] Test and fix all pages on mobile (375px), tablet (768px), desktop (1280px+)
- [ ] Ensure touch targets are at least 44px on mobile
- [ ] Test navbar hamburger menu functionality
- [ ] Test forms and modals on small screens

### 14.2 — Loading & error states
- [ ] Add skeleton loaders for all data-fetching pages (listings grid, profile, trade detail)
- [ ] Add error boundaries with "Something went wrong" + retry button
- [ ] Add 404 page for invalid routes
- [ ] Add proper error pages for API failures (network down, 500s)
- [ ] Toast notifications for all user actions (created, updated, deleted, error)

### 14.3 — Accessibility
- [ ] Semantic HTML everywhere (nav, main, article, section, headings hierarchy)
- [ ] All images have alt text
- [ ] All form inputs have labels
- [ ] Keyboard navigation works for all interactive elements
- [ ] Focus management on modals and page transitions
- [ ] Color contrast meets WCAG AA (4.5:1 for text)

### 14.4 — SEO & metadata
- [ ] Dynamic page titles and meta descriptions for listing pages, profiles
- [ ] Open Graph tags for social sharing (listing title, image, description)
- [ ] `robots.txt` and `sitemap.xml`
- [ ] Structured data (JSON-LD) for listings (Product schema)

### 14.5 — Performance
- [ ] Optimize images: use Next.js `<Image>` component with proper sizing
- [ ] Lazy load below-fold content (listing images, ratings lists)
- [ ] Bundle analysis — ensure no unnecessary large dependencies
- [ ] Cache static assets with proper headers (nginx already configured)

### 14.6 — Final pre-launch checklist
- [ ] Replace all placeholder donation addresses
- [ ] Set real Google OAuth credentials (not dev/test)
- [ ] Configure production environment variables
- [ ] Run full test suite — all ~84 tests pass
- [ ] Manual smoke test of every user flow: register → create listing → browse → make offer → accept → complete → rate
- [ ] Set up database backups
- [ ] Set up basic uptime monitoring
- [ ] Deploy to production VPS

---

## Task Dependency Graph

```
Phase 5 (Foundation) ──┬──→ Phase 6 (Auth Pages)
                       │         │
                       │         ├──→ Phase 7 (Listings) ──→ Phase 9 (Trades) ──→ Phase 9.4 (Ratings)
                       │         │         │
                       │         │         └──→ Phase 10 (Messaging)
                       │         │
                       │         └──→ Phase 8 (User Profiles)
                       │
                       └──→ Phase 12 (Static Pages)

Phase 13 (Security) ── independent, can be done in parallel

Phase 11 (Moderation UI) ── depends on Phase 13.1 (admin role) + Phase 7 (listings exist)

Phase 14 (Polish) ── after all UI phases are done
```

---

## Estimated Task Count

| Phase | Tasks | Subtasks |
|---|---|---|
| 5 — Frontend Foundation | 7 | ~35 |
| 6 — Auth Pages | 4 | ~15 |
| 7 — Listings (Billboard) | 6 | ~25 |
| 8 — User Profiles | 3 | ~12 |
| 9 — Trade Flow | 4 | ~16 |
| 10 — Messaging | 3 | ~12 |
| 11 — Moderation UI | 2 | ~8 |
| 12 — Static Pages | 4 | ~14 |
| 13 — Security Fixes | 4 | ~14 |
| 14 — Polish & Launch | 6 | ~24 |
| **Total** | **43** | **~175** |
