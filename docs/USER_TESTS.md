# USER_TESTS.md — Comprehensive Manual QA Guide

This file gives you **exact inputs and expected results** for every test scenario.
Work through each section and mark ✅ pass or ❌ fail next to each item.

Start the stack:
```bash
docker compose up -d
```
Site: http://localhost (via nginx) or http://localhost:3000 (dev)

---

## 1. Authentication

### 1.1 Email Registration

**Test A — Successful registration**
- Email: `buyer@test.local`
- Password: `Correct$horse9`
- ✅ Expected: redirected to `/`, navbar shows a generated nickname (e.g. `BlueFox42`)

**Test B — Weak password (too short)**
- Email: `weak@test.local`
- Password: `abc123`
- ✅ Expected: error "Password must be at least 8 characters" — no account created

**Test C — Duplicate email**
- Register again with `buyer@test.local` + any password
- ✅ Expected: error "Email already registered"

**Test D — Missing fields**
- Leave email blank, enter password `Correct$horse9`
- ✅ Expected: form validation prevents submission

---

### 1.2 Email Login

**Test A — Correct credentials**
- Email: `buyer@test.local` | Password: `Correct$horse9`
- ✅ Expected: logged in, redirected to `/`

**Test B — Wrong password**
- Email: `buyer@test.local` | Password: `wrongpassword`
- ✅ Expected: error "Invalid email or password"

**Test C — Unknown email**
- Email: `nobody@test.local` | Password: `Correct$horse9`
- ✅ Expected: error "Invalid email or password" (same message — no user enumeration)

**Test D — Case-insensitive email**
- Email: `BUYER@TEST.LOCAL` | Password: `Correct$horse9`
- ✅ Expected: login succeeds (email is normalised to lowercase)

---

### 1.3 Session Persistence

**Test A — Session survives tab close**
1. Log in as `buyer@test.local`
2. Close the browser tab entirely
3. Reopen http://localhost
- ✅ Expected: still logged in (refresh token cookie kept you alive)

**Test B — Session clears after logout**
1. Click Logout in navbar
2. Close and reopen browser
- ✅ Expected: redirected to `/login`

---

### 1.4 Rate Limiting on Login

**Test A — Rate limit triggers**
1. Go to `/login`
2. Enter email `buyer@test.local` + wrong password `badpass1` → submit
3. Repeat 5 times rapidly
- ✅ Expected: 5th or 6th attempt returns "Too many requests — please slow down"
- Wait 1 minute, then login succeeds again

---

### 1.5 Auth Guard

**Test A — Protected routes redirect unauthenticated users**
While logged out, navigate directly to each URL:
- `/listings/new` → ✅ redirected to `/login`
- `/dashboard/trades` → ✅ redirected to `/login`
- `/messages` → ✅ redirected to `/login`
- `/settings` → ✅ redirected to `/login`
- `/admin/flags` → ✅ redirected to `/login` (or home if logged in as non-admin)

**Test B — Public pages load without login**
While logged out:
- `/` → ✅ loads (landing page)
- `/about` → ✅ loads
- `/privacy` → ✅ loads
- `/donate` → ✅ loads

---

## 2. Profile

### 2.1 View Own Profile

1. Log in as `buyer@test.local`
2. Click your nickname in the navbar
- ✅ Expected: `/user/<your-nickname>` shows nickname, "New" reputation tier, no edit button (that's on settings)

---

### 2.2 Edit Nickname

Navigate to `/settings` → Edit profile

**Test A — Valid nickname**
- Enter: `CryptoKing99`
- ✅ Expected: saved, navbar updates to `CryptoKing99`

**Test B — Too short**
- Enter: `ab`
- ✅ Expected: error "Must be 3–30 characters"

**Test C — Too long**
- Enter: `abcdefghijklmnopqrstuvwxyz12345` (31 chars)
- ✅ Expected: error "Must be 3–30 characters"

**Test D — Invalid characters**
- Enter: `hello world` (space)
- ✅ Expected: error "Only letters, numbers, _ and - allowed"

**Test E — Taken nickname**
1. Register a second account `seller@test.local`
2. Note its generated nickname, e.g. `RedWolf11`
3. Try to set your nickname to `RedWolf11`
- ✅ Expected: error "Nickname already taken"

---

### 2.3 Edit Bio

Navigate to `/settings/profile`

**Test A — Valid bio**
- Enter: `Privacy-first trader. BTC only.`
- ✅ Expected: saved, bio appears on your public profile `/user/<nickname>`

**Test B — Bio over limit**
- Paste 501 characters of text
- ✅ Expected: form shows "Bio must be 500 characters or less" or truncates at 500

**Test C — Empty bio (clear it)**
- Delete all bio text, save
- ✅ Expected: bio field removed from profile view

---

### 2.4 Avatar Upload

Navigate to `/settings/profile` → click camera icon

**Test A — Valid JPEG**
- Upload any small JPEG photo
- ✅ Expected: avatar updates in the profile page and navbar

**Test B — Valid PNG**
- Upload a PNG image
- ✅ Expected: avatar updates successfully

**Test C — Non-image file**
- Upload a `.pdf` or `.txt` file
- ✅ Expected: error "Only JPEG, PNG, and WebP images are allowed"

**Test D — File too large**
- Upload an image larger than 5 MB
- ✅ Expected: error about file size limit

**Test E — EXIF stripping (privacy check)**
1. Take a photo with your smartphone (it embeds GPS coordinates)
2. Upload it as your avatar
3. Download the saved avatar image (right-click → save image as)
4. Open with ExifTool or Jeffrey's Exif Viewer online
- ✅ Expected: no GPS, camera model, or personal EXIF data present

---

### 2.5 View Another User's Profile

1. Open a listing posted by `seller@test.local`
2. Click their nickname
- ✅ Expected: `/user/<nickname>` shows their public profile — no edit controls, shows reputation score

---

## 3. Listings

### 3.1 Create a Listing

Navigate to `/listings/new`

**Test A — Minimal valid listing**
- Title: `Bitcoin Miner Antminer S19`
- Description: `Selling my Antminer S19 Pro. Works perfectly, 110 TH/s.`
- Payment: check BTC
- ✅ Expected: redirected to new listing detail page

**Test B — Title too short**
- Title: `Hi` (2 chars)
- ✅ Expected: error "Title must be 3-200 characters"

**Test C — Title too long**
- Title: 201 characters of text
- ✅ Expected: error "Title must be 3-200 characters"

**Test D — Description too short**
- Description: `Short` (5 chars)
- ✅ Expected: error "Description must be 10-5000 characters"

**Test E — No payment method selected**
- Leave all checkboxes unchecked
- ✅ Expected: error "At least one payment method is required"

**Test F — Blocked keyword**
- Title: `Selling stolen laptop`
- ✅ Expected: error about blocked keyword "stolen"

**Test G — Full listing with price**
- Title: `Vintage Leica M6 Camera`
- Description: `Mint condition Leica M6 TTL, 0.72 viewfinder. Includes original leather case and strap. No mods.`
- Category: select Electronics (or similar)
- Payment: XMR + Cash
- Price: `850`
- Currency: `EUR`
- ✅ Expected: listing created, price and currency shown on detail page

---

### 3.2 Upload Images

On the new listing's detail page or edit page

**Test A — Upload 1 image**
- Upload a JPEG photo
- ✅ Expected: image appears in gallery

**Test B — Upload up to 5 images**
- Upload 5 different images one by one
- ✅ Expected: all 5 appear in gallery with thumbnail row

**Test C — Reject 6th image**
- Attempt to upload a 6th image
- ✅ Expected: error "Maximum 5 images per listing"

**Test D — Reject non-image**
- Try uploading a `.pdf` file
- ✅ Expected: error "Only JPEG, PNG, and WebP images are allowed"

---

### 3.3 Search & Filter Listings

Navigate to `/listings`

**Test A — Keyword search**
- Search: `Leica`
- ✅ Expected: only listings mentioning "Leica" in title/description appear

**Test B — Search with no results**
- Search: `zxqwerty_nonexistent_keyword`
- ✅ Expected: empty results, no error

**Test C — Filter by payment method**
- Select "XMR" from payment filter
- ✅ Expected: only listings that accept XMR shown

**Test D — Filter by category**
- Select "Electronics" (or whatever you created)
- ✅ Expected: only listings in that category shown

**Test E — Pagination**
- Create 25+ listings, browse to page 2
- ✅ Expected: new set of listings, pagination shows page 2

---

### 3.4 Edit Own Listing

Open one of your listings → Edit

**Test A — Change title**
- New title: `Leica M6 TTL — Price Reduced`
- ✅ Expected: title updated on detail page

**Test B — Pause listing**
- Change status to "Paused"
- ✅ Expected: listing shows "Paused" badge; does NOT appear in `/listings` search (filtered to active by default)

**Test C — Resume listing**
- Change status back to "Active"
- ✅ Expected: listing appears in search again

---

### 3.5 Delete Listing

Navigate to My Listings dashboard or listing detail

**Test A — Delete with confirmation**
- Click Delete → confirm dialog → confirm
- ✅ Expected: listing removed, redirected to `/listings`, listing no longer searchable

**Test B — Cancel delete**
- Click Delete → click Cancel in dialog
- ✅ Expected: listing not deleted, dialog closes

---

### 3.6 Access Control on Listings

**Test A — Cannot edit another user's listing**
1. Note the ID of `seller@test.local`'s listing (e.g. `abc-123`)
2. While logged in as `buyer@test.local`, navigate to `/listings/abc-123/edit`
- ✅ Expected: 403 error or redirect to home — cannot edit

**Test B — No edit/delete buttons for non-owner**
- Open any listing you didn't create
- ✅ Expected: Edit and Delete buttons not shown; only Make Offer and Message Seller

---

## 4. Trades

**Setup:** Log in as `seller@test.local`, create an active listing. Log out. Log in as `buyer@test.local`.

### 4.1 Initiate a Trade

Open `seller@test.local`'s active listing

**Test A — Make Offer**
- Click "Make Offer"
- ✅ Expected: redirected to `/messages/<thread-id>`, trade appears in `/dashboard/trades` with status "Offered"

**Test B — Cannot trade on own listing**
- Log in as `seller@test.local`, open your own listing
- ✅ Expected: no "Make Offer" button — only Edit and Delete

---

### 4.2 Accept / Decline (as Seller)

Log in as `seller@test.local`, go to `/dashboard/trades`

**Test A — Accept trade**
- Find the incoming offer, click Accept
- ✅ Expected: trade status changes to "Accepted"

**Test B — Decline trade**
- Create a second offer (as buyer), then as seller click Decline
- ✅ Expected: trade status changes to "Declined"

---

### 4.3 Cancel (as Buyer)

Log in as `buyer@test.local`

**Test A — Cancel offered trade**
- Find an "Offered" trade, click Cancel
- ✅ Expected: status → "Cancelled"

**Test B — Cancel accepted trade**
- Find an "Accepted" trade, click Cancel
- ✅ Expected: status → "Cancelled"

---

### 4.4 Complete Trade (Both Must Confirm)

Have an "Accepted" trade between buyer and seller

**Test A — First confirmation**
1. As `buyer@test.local`: click "Confirm Completion"
- ✅ Expected: message "Waiting for the other party to confirm", trade still "Accepted"

**Test B — Second confirmation completes trade**
2. As `seller@test.local`: click "Confirm Completion"
- ✅ Expected: trade status → "Completed", success message shown

**Test C — Cannot confirm twice**
1. As buyer, confirm completion
2. As buyer, try to confirm again
- ✅ Expected: error "You already confirmed completion"

---

## 5. Ratings

**Setup:** Complete a trade between `buyer@test.local` and `seller@test.local`.

### 5.1 Leave a Rating

On the completed trade page

**Test A — 5-star rating with comment**
- As buyer: select 5 stars, comment: `Smooth trade, fast response. Highly recommend!`
- ✅ Expected: rating saved, seller's reputation score updates

**Test B — 1-star rating**
- As seller: select 1 star, comment: `Buyer was unresponsive for days.`
- ✅ Expected: rating saved, buyer's reputation score updates

**Test C — Rating without comment**
- Select 3 stars, leave comment blank
- ✅ Expected: rating accepted (comment is optional)

---

### 5.2 Cannot Rate Twice

**Test A**
1. Rate a completed trade
2. Try to submit another rating for the same trade
- ✅ Expected: error "You have already rated this trade"

---

### 5.3 Reputation Tier

Check `/user/<nickname>` profile after trades:

| Completed trades | Expected tier |
|---|---|
| 0–2 | New |
| 3–14 | Verified |
| 15–49 | Trusted |
| 50+ | Elite |

---

## 6. Messaging

### 6.1 Send and Receive a Message

**Test A — Send message**
1. As `buyer@test.local`, open a listing → "Message Seller"
2. Type: `Hello, is this still available?`
3. Send
- ✅ Expected: message appears in thread, timestamp shown

**Test B — Receive message**
1. Log in as `seller@test.local`
2. Go to `/messages`
- ✅ Expected: conversation visible, message readable as plain text

**Test C — Reply**
1. As seller, type: `Yes, still available. What's your offer?`
2. Send
- ✅ Expected: reply appears in thread for both parties

---

### 6.2 Message Privacy

**Test A — Third party cannot access thread**
1. Note the thread URL: `/messages/<thread-id>`
2. Log in as `other@test.local` (a third user not in the conversation)
3. Navigate to that thread URL
- ✅ Expected: 403 error or redirect — message content not visible

---

## 7. Report Listing

### 7.1 Submit a Report

Open any listing you don't own

**Test A — Valid report**
- Click "Report listing"
- Reason: `This listing is selling counterfeit electronics.`
- Click Submit
- ✅ Expected: success message "Report submitted. Thank you for helping keep Bartr safe."

**Test B — Reason too short**
- Reason: `bad` (3 chars)
- ✅ Expected: Submit button stays disabled (min 5 chars required)

**Test C — Duplicate report**
- Try to report the same listing again
- ✅ Expected: error "You already reported this listing."

**Test D — Cannot report own listing**
- Open your own listing
- ✅ Expected: no "Report listing" button visible

---

## 8. Admin Panel

**Setup:** Set a test account to admin role:
```sql
UPDATE users SET role = 'admin' WHERE nickname = 'YourAdminNickname';
```
Then log in as that account.

### 8.1 Access Admin Panel

**Test A — Admin can access /admin/flags**
- Navigate to `/admin/flags`
- ✅ Expected: Moderation panel loads, shows pending flags

**Test B — Regular user cannot access /admin/flags**
- Log in as `buyer@test.local`, navigate to `/admin/flags`
- ✅ Expected: redirected to home `/`

---

### 8.2 Review Flags

On `/admin/flags` with pending flags visible

**Test A — Dismiss a flag**
- Click Dismiss on a pending flag
- ✅ Expected: flag disappears from Pending tab, appears in Dismissed tab

**Test B — Mark as reviewed**
- Click "Mark reviewed" on a pending flag
- ✅ Expected: flag moves to Reviewed tab

**Test C — Resolve a flag**
- Click Resolve on a pending flag
- ✅ Expected: flag moves to Resolved tab

**Test D — Filter by status**
- Click "Dismissed" tab
- ✅ Expected: only dismissed flags shown

---

## 9. Dark Mode / Light Mode

### 9.1 Toggle via Settings

1. Log in, go to `/settings`
2. Click the "Dark mode" / "Light mode" button in Appearance section
- ✅ Expected: entire UI switches theme instantly (no page reload)

### 9.2 Toggle via Navbar

1. Click your avatar in the navbar to open the dropdown
2. Click the theme toggle item (shows Sun/Moon icon)
- ✅ Expected: theme switches immediately

### 9.3 Persistence

1. Switch to dark mode
2. Close browser, reopen http://localhost
- ✅ Expected: dark mode still active

1. Switch to light mode
2. Close browser, reopen
- ✅ Expected: light mode still active

### 9.4 System Preference (when no override set)

1. Clear localStorage (DevTools → Application → Local Storage → delete `theme`)
2. Set your OS to dark mode
3. Reload the page
- ✅ Expected: site uses dark mode automatically

4. Set OS to light mode, reload
- ✅ Expected: site uses light mode

### 9.5 All Pages Readable in Both Modes

Check each page in both light and dark mode — look for invisible text, broken contrast, or missing elements:

| Page | Dark ✅ | Light ✅ |
|---|---|---|
| `/` (home) | | |
| `/listings` | | |
| `/listings/<id>` | | |
| `/listings/new` | | |
| `/dashboard/listings` | | |
| `/dashboard/trades` | | |
| `/messages` | | |
| `/settings` | | |
| `/settings/profile` | | |
| `/about` | | |
| `/privacy` | | |
| `/donate` | | |
| `/admin/flags` (admin only) | | |

---

## 10. Security Edge Cases

### 10.1 XSS Prevention

**Test A — Script in listing title**
- Create a listing with title: `<script>alert('xss')</script>`
- ✅ Expected: text appears literally on the page — no alert popup, no script executes

**Test B — Script in listing description**
- Description: `Buy this <img src=x onerror=alert('xss')> great item`
- ✅ Expected: rendered as literal text or stripped — no alert

**Test C — Script in bio**
- Bio: `<script>document.body.innerHTML='hacked'</script>`
- ✅ Expected: displayed as text, page content not modified

---

### 10.2 Large File Rejection

**Test A — Image > 5 MB**
- Attempt to upload an image file larger than 5 MB to a listing or avatar
- ✅ Expected: upload rejected with file size error

---

### 10.3 Invalid File Type (Magic Bytes)

**Test A — Renamed non-image**
1. Take a text file `test.txt`, rename it to `test.jpg`
2. Try to upload it as a listing image
- ✅ Expected: rejected — "Invalid image" or "Only JPEG, PNG, and WebP images are allowed"

---

## 11. Test Account Reference

| Role | Email | Password | Notes |
|---|---|---|---|
| Buyer | `buyer@test.local` | `Correct$horse9` | Regular user |
| Seller | `seller@test.local` | `Correct$horse9` | Regular user |
| Admin | `admin@test.local` | `Correct$horse9` | Set `role='admin'` in DB |
| Third | `other@test.local` | `Correct$horse9` | For access control tests |

**Grant admin role:**
```sql
UPDATE users SET role = 'admin' WHERE nickname = '<admin-nickname>';
```

**Find nickname after registration:**
```sql
SELECT nickname FROM users WHERE email_hash = encode(hmac(lower('admin@test.local'), decode('<ENCRYPTION_KEY>', 'hex'), 'sha256'), 'hex');
```
Or just check the navbar after logging in.

---

*Stack: Next.js + Fastify + PostgreSQL | 592 automated tests passing | Updated: 2026-02-27*
