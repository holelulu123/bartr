# ROADMAP V4 — Manual Browser Testing Guide

This document is a **click-through test plan** for manual QA in the browser.
No unit tests or API calls — just open the site, follow each scenario, and verify the expected result.

Start the stack first:
```bash
docker compose up -d
cd packages/api && pnpm dev &
cd packages/web && pnpm dev &
```
Site: http://localhost:3000 | API: http://localhost:4000

---

## 1. Authentication

### 1.1 Email Registration
1. Go to `/login`, click **"Create account"**
2. Enter email + password (8+ chars) + confirm password
3. Click **Register**
4. **Expected**: Redirected to home `/`, navbar shows your nickname (e.g. `BlueFox42`)

### 1.2 Email Login
1. Log out (navbar → dropdown → Logout)
2. Go to `/login`, enter the same email + password
3. Click **Login**
4. **Expected**: Back on home, authenticated as same user

### 1.3 Wrong Password
1. Go to `/login`, enter correct email but wrong password
2. **Expected**: Error message "Invalid email or password" — no redirect

### 1.4 Session Persistence
1. Log in, then close the browser tab and reopen http://localhost:3000
2. **Expected**: Still logged in (refresh token cookie survives)

### 1.5 Google OAuth (requires Google credentials configured)
1. Click **Continue with Google**
2. Complete Google sign-in flow
3. **Expected**: Redirected back, logged in with Google account

### 1.6 Logout
1. Click the user avatar / nickname in navbar → **Logout**
2. **Expected**: Redirected to `/login` (or home), no longer authenticated

---

## 2. Profile

### 2.1 View Own Profile
1. Log in, click your nickname in the navbar
2. **Expected**: Profile page shows nickname, bio (if set), avatar placeholder, reputation tier "New"

### 2.2 Edit Nickname
1. Go to `/settings` (or profile edit page)
2. Change nickname to something unique (3–30 chars)
3. Save
4. **Expected**: Navbar updates to new nickname

### 2.3 Edit Bio
1. Go to profile settings, enter a bio (max 500 chars)
2. Save
3. **Expected**: Bio shows on profile page

### 2.4 Upload Avatar
1. Go to profile settings → upload a JPEG/PNG/WebP image
2. **Expected**: Avatar appears in navbar and profile page

### 2.5 Reject Non-Image File
1. Try uploading a `.txt` or `.pdf` as avatar
2. **Expected**: Error "Only JPEG, PNG, and WebP images are allowed"

### 2.6 View Another User's Public Profile
1. Note a seller's nickname from a listing
2. Navigate to `/users/<nickname>`
3. **Expected**: Public profile with reputation score visible; no edit controls

---

## 3. Listings

### 3.1 Create a Listing
1. Click **"Post Listing"** (or go to `/listings/new`)
2. Fill: title (3–200 chars), description (10–5000 chars), select a category, check at least one payment method
3. Click **Submit**
4. **Expected**: Redirected to the new listing page, listing is visible

### 3.2 Upload Images to Listing
1. On the new listing page (or edit page), click **Add Image**
2. Upload up to 5 images
3. **Expected**: Images appear in a gallery on the listing

### 3.3 Reject 6th Image
1. On a listing with 5 images, try uploading a 6th
2. **Expected**: Error "Maximum 5 images per listing"

### 3.4 Edit Own Listing
1. Go to your listing → **Edit**
2. Change the title or description
3. Save
4. **Expected**: Changes reflected on listing detail page

### 3.5 Change Listing Status
1. On your listing → **Edit** or **My Listings** dashboard
2. Change status to **Paused**
3. **Expected**: Listing shows "Paused" badge; doesn't appear in public search

### 3.6 Search Listings
1. Go to `/listings` (browse page)
2. Type a keyword in the search box
3. **Expected**: Only matching listings appear (full-text search)

### 3.7 Filter by Category
1. Select a category from the dropdown
2. **Expected**: Only listings in that category shown

### 3.8 Filter by Payment Method
1. Select "BTC" from payment filter
2. **Expected**: Only listings accepting BTC shown

### 3.9 Delete Listing
1. Go to **My Listings**, click **Delete** on a listing
2. Confirm the prompt
3. **Expected**: Listing removed from your dashboard and from search

### 3.10 Cannot Edit Someone Else's Listing
1. Note the ID of another user's listing
2. Try navigating to `/listings/<id>/edit`
3. **Expected**: 403 / redirect to home

---

## 4. Trades

### 4.1 Initiate a Trade (as Buyer)
1. Open an active listing from another user
2. Click **"Make Offer"** or **"Contact Seller"**
3. **Expected**: Trade created, appears in `/trades` with status "Offered"

### 4.2 Cannot Trade on Own Listing
1. Open one of your own active listings
2. **Expected**: No "Make Offer" button — or button disabled/hidden

### 4.3 Accept a Trade (as Seller)
1. Log in as the seller account
2. Go to `/trades`, find the incoming offer
3. Click **Accept**
4. **Expected**: Trade status changes to "Accepted"

### 4.4 Decline a Trade (as Seller)
1. As seller, find an "Offered" trade
2. Click **Decline**
3. **Expected**: Trade status changes to "Declined"

### 4.5 Cancel a Trade (as Buyer)
1. As buyer, find an "Offered" or "Accepted" trade
2. Click **Cancel**
3. **Expected**: Trade status changes to "Cancelled"

### 4.6 Complete a Trade (Both Parties Must Confirm)
1. As buyer, click **Confirm Completion** on an "Accepted" trade
2. **Expected**: Message "Waiting for the other party to confirm"
3. Log in as seller, find the same trade, click **Confirm Completion**
4. **Expected**: Trade status changes to "Completed"

---

## 5. Ratings

### 5.1 Rate After Trade
1. On a completed trade, click **Leave Rating**
2. Select 1–5 stars and optionally write a comment
3. Submit
4. **Expected**: Rating saved; seller's/buyer's reputation score updated

### 5.2 Cannot Rate Twice
1. Try to submit another rating for the same trade
2. **Expected**: Error "You have already rated this trade"

### 5.3 Reputation Tier Progression
- After 3+ completed trades with good ratings: profile shows **Verified** tier
- After 15+: **Trusted** tier
- After 50+: **Elite** tier

---

## 6. Messaging (End-to-End Encrypted)

### 6.1 Send a Message
1. Open a listing or trade, click **Message Seller/Buyer**
2. Type a message and send
3. **Expected**: Message appears in the conversation thread

### 6.2 Receive a Message
1. Log in as the other party
2. Go to `/messages`
3. **Expected**: New message notification; message is readable

### 6.3 Messages Are Private
1. As a third user, try accessing the message thread URL directly
2. **Expected**: 403 or redirect — messages not visible

---

## 7. Moderation (Admin Only)

### 7.1 Flag a Listing (User)
1. On any listing, click **Report**
2. Select a reason and submit
3. **Expected**: Confirmation "Report submitted"

### 7.2 Admin: View Flags
1. Log in as an admin account (set `role = 'admin'` in DB)
2. Go to `/admin/flags`
3. **Expected**: List of reported listings with reasons

### 7.3 Admin: Resolve a Flag
1. On a flagged listing, click **Approve** or **Remove**
2. **Expected**: Flag resolved, listing status updated if removed

### 7.4 Non-Admin Cannot Access Admin Panel
1. Log in as a regular user, navigate to `/admin/flags`
2. **Expected**: 403 error or redirect

---

## 8. Security & Edge Cases

### 8.1 Auth Required for Protected Pages
1. Log out, then try to navigate directly to `/listings/new`, `/trades`, `/messages`
2. **Expected**: Redirected to `/login`

### 8.2 Public Pages Accessible Without Login
1. While logged out, visit `/`, `/about`, `/privacy`, `/donate`
2. **Expected**: Pages load without redirect

### 8.3 Rate Limit on Login
1. Attempt to log in with wrong password 6+ times in one minute
2. **Expected**: After 5 attempts: "Too many requests — please slow down" (429)

### 8.4 EXIF Metadata Stripped from Images
1. Upload a photo taken with a smartphone (contains GPS/EXIF data)
2. Download the uploaded image from the listing
3. **Expected**: EXIF data is not present in downloaded image

### 8.5 Large File Rejected
1. Try uploading an image > 5MB
2. **Expected**: Error about file size limit

### 8.6 XSS Prevention
1. In a listing title or description, type `<script>alert('xss')</script>`
2. **Expected**: The text appears as literal characters, no alert popup

---

## 9. Dark Mode / Light Mode (Upcoming Feature)

> **Status: Not yet implemented** — planned for next sprint.

When implemented, verify:

### 9.1 Toggle Theme from Settings
1. Go to `/settings`
2. Click the **Dark Mode** / **Light Mode** toggle
3. **Expected**: Entire UI switches theme immediately without page reload

### 9.2 Theme Persists Across Sessions
1. Switch to dark mode, close the browser, reopen the site
2. **Expected**: Dark mode is still active (preference saved in localStorage)

### 9.3 System Preference Respected
1. Without setting a preference, change OS to dark mode
2. **Expected**: Site follows system dark mode automatically

### 9.4 All Pages Readable in Both Modes
- Browse: `/`, `/listings`, `/listings/<id>`, `/trades`, `/messages`, `/settings`, `/about`, `/privacy`, `/donate`
- Verify: no invisible text, no clashing colors, all buttons visible

---

## 10. Performance Sanity Checks

### 10.1 Listing Search Response Time
1. Search for a common keyword with 20+ results
2. **Expected**: Results appear within 1 second

### 10.2 Image Loading
1. Open a listing with multiple images
2. **Expected**: Images load progressively, no broken image icons

### 10.3 Pagination
1. Browse listings page and click **Next Page**
2. **Expected**: New set of listings loads, pagination controls update correctly

---

## Test Accounts Setup

For a complete manual test run, create these accounts:

| Role    | Email               | Purpose                           |
|---------|---------------------|-----------------------------------|
| Buyer   | buyer@test.local    | Initiating trades, rating sellers |
| Seller  | seller@test.local   | Posting listings, accepting trades |
| Admin   | admin@test.local    | Set `role = 'admin'` in DB        |
| Third   | other@test.local    | Testing access control            |

To set admin role:
```sql
UPDATE users SET role = 'admin' WHERE email_hash = '<hash>';
-- Or find by nickname:
UPDATE users SET role = 'admin' WHERE nickname = 'YourAdminNickname';
```

---

*Generated: 2026-02-27 | Stack: Next.js + Fastify + PostgreSQL | 559 automated tests passing*
