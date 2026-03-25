# Waitlist Lead Capture

**Date:** 2026-03-25
**Status:** Draft

## Goal

Replace the `mailto:kahessay@icloud.com` email links on the landing page with an inline waitlist form. Collect email addresses (and optional GitHub usernames) from people interested in the private beta.

This is pre-beta lead capture — no access codes, no queue positions, no transactional emails. Just a list of interested people we can reach out to when the private beta opens.

## Frontend

### New component: `<WaitlistForm />`

**File:** `studio/components/landing/waitlist-form.tsx`

Client component with two fields:
- **Email** (required) — standard email input
- **GitHub username** (optional) — text input with `@` prefix hint

Submit button labeled "Join the waitlist."

**States:**
- **Idle** — form visible, ready for input
- **Submitting** — button disabled, loading indicator
- **Success** — form replaced with: "You're on the list. We'll reach out when the private beta opens."
- **Error** — inline error message below form, form stays usable

**Styling:** Matches existing landing page aesthetic — cream palette, monospace for field labels, sans-serif for body text. No decorative animation.

**Request:** `POST {API_URL}/pub/waitlist` with `{ email, github_username? }`

### Modified files

**`studio/components/landing/pricing.tsx`**
- In the $1 "Early Adopter" card: replace the "Need an access code? Email kahessay@icloud.com" paragraph with `<WaitlistForm />`

**`studio/components/landing/bottom-cta.tsx`**
- Replace the email contact link with `<WaitlistForm />`

## Backend

### New route: `POST /pub/waitlist`

**File:** `console/routes/pub-waitlist.js`

- Accepts `{ email, github_username? }`
- Validates email format (basic regex — presence of `@` and a dot in the domain)
- Normalizes GitHub username: strip leading `@`, lowercase, trim
- Inserts into `waitlist` table
- Duplicate email: returns `{ ok: true }` (same as success — don't leak whether email exists)
- Returns `{ ok: true }` on success
- Returns `{ error: "..." }` with 400 on validation failure

### New route: `GET /api/waitlist`

**File:** `console/routes/pub-waitlist.js` (or same file, operator section)

- Operator-only (requires `operatorId` cookie, same auth as access code routes)
- Returns all waitlist entries ordered by `created_at DESC`
- Supports `?format=csv` for easy export

### Database schema

**New table in `console/lib/db.js`:**

```sql
CREATE TABLE IF NOT EXISTS waitlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  github_username TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  notes TEXT
);
```

- `email` is unique — one signup per email
- `github_username` is optional, stored lowercase without `@`
- `notes` is freeform for manual annotation (e.g., "sent beta invite 2026-04-01")

### Route registration

Register the new route file in `console/server.js` alongside existing pub/api routes.

## Out of scope

- Confirmation emails
- Queue position display
- Auto-issuance of access codes
- Rate limiting (Fly proxy provides baseline protection)
- Email verification
- CAPTCHA

## Testing

- Submit with valid email -> 200, form shows confirmation
- Submit with email + GitHub username -> 200, both stored
- Submit with invalid email -> 400, form shows error
- Submit duplicate email -> 200, same confirmation (no leak)
- Submit with empty email -> 400
- `GET /api/waitlist` without operator cookie -> 401
- `GET /api/waitlist` with operator cookie -> list of signups
