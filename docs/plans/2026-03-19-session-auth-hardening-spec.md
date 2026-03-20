# Session Auth Hardening — Spec

**Date**: 2026-03-19
**Status**: Draft
**Blocks**: Tier 0.1 of self-serve build flow plan
**Scope**: Console backend only. No frontend changes unless noted.

---

## Problem

The build session API has three auth gaps that are acceptable for demo but not for external self-serve:

1. **Unauthenticated reads**: `GET /pub/build-session/:id` and `GET /pub/build-session/:id/stream` accept any request with a valid session ID. Session IDs are UUIDs visible in URLs, so anyone with the URL can read another user's PRD, chat history, and build events.

2. **Unauthenticated writes**: `POST /pub/build-session/:id/message` accepts any request with a valid session ID. Anyone can inject messages into another user's LLM conversation.

3. **Session hijack via finalize**: `POST /pub/build-session/:id/finalize` binds a session to whichever authenticated user calls it first. A real session created without auth (`user_id: null` at line 50 of pub-build-session.js) can be claimed by any authenticated user who knows the session ID.

```
Current auth model:

  POST /pub/build-session           → no auth (creates session with user_id: null for real)
  GET  /pub/build-session/:id       → no auth (anyone with ID can read)
  POST /pub/build-session/:id/msg   → no auth (anyone with ID can write)
  GET  /pub/build-session/:id/stream → no auth (anyone with ID can stream)
  POST /pub/build-session/:id/finalize → auth required, but claims ANY unowned session
  POST /pub/build-session/:id/provision → auth + ownership ✓
  POST /pub/build-session/:id/start-build → auth + ownership ✓

Target auth model:

  POST /pub/build-session           → auth required for real sessions (demo stays unauthenticated)
  GET  /pub/build-session/:id       → owner-only for real sessions (demo stays open)
  POST /pub/build-session/:id/msg   → owner-only for real sessions (demo stays open)
  GET  /pub/build-session/:id/stream → owner-only for real sessions (demo stays open)
  POST /pub/build-session/:id/finalize → owner-only (no more claiming unowned sessions)
  POST /pub/build-session/:id/provision → auth + ownership ✓ (no change)
  POST /pub/build-session/:id/start-build → auth + ownership ✓ (no change)
```

## Design

### Principle: demo stays frictionless, real requires auth

Demo sessions (`is_demo: true`) remain fully unauthenticated. The mock user (`github_id: 0`) is created server-side and the session is immediately owned. No auth cookies needed for reads or writes. This preserves the zero-friction "Watch it build" experience.

Real sessions require the `build_session` auth cookie for ALL operations. No anonymous real sessions exist.

### Change 1: Real session creation requires auth

**Current** (pub-build-session.js:49-51):
```js
const userId = resolveUserId(db, req);           // null if no cookie
const session = buildSessionStore.createSession(userId);  // user_id: null
```

**New**: If `demo !== true` and no valid auth cookie exists, return 401. Real sessions always have an owner from creation.

```js
if (!isDemo) {
  const userId = resolveUserId(db, req);
  if (!userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const session = buildSessionStore.createSession(userId);
  return res.status(201).json({ sessionId: session.id });
}
```

**Frontend impact**: The `/build` page currently creates a real session immediately on load. After this change, it must check auth first. If unauthenticated, show a "Sign in with GitHub to start" CTA instead of auto-creating a session. The demo path (`?demo=true`) is unchanged.

### Change 2: Owner-gated reads and writes

Add a shared middleware/helper that resolves session ownership for all `/pub/build-session/:id/*` routes:

```js
function resolveSessionAccess(db, req) {
  const session = buildSessionStore.getSession(req.params.id);
  if (!session) return { status: 404, error: "Session not found" };

  // Demo sessions are open to anyone
  if (session.is_demo) return { session, allowed: true };

  // Real sessions require authenticated owner
  const userId = resolveUserId(db, req);
  if (!userId) return { status: 401, error: "Authentication required" };
  if (session.user_id !== userId) return { status: 404, error: "Session not found" };

  return { session, allowed: true, userId };
}
```

Apply to:
- `GET /pub/build-session/:id` — return 404 (not 403) for non-owners to avoid leaking session existence
- `POST /pub/build-session/:id/message` — same check before LLM call
- `GET /pub/build-session/:id/stream` — same check before SSE connection
- `POST /pub/build-session/:id/finalize` — replace current `resolveUserId` + naked `getSession` with `resolveSessionAccess`

### Change 3: Remove anonymous session claiming from finalize

**Current** (pub-build-session.js:172):
```js
buildSessionStore.updateSession(session.id, {
  user_id: userId,   // ← binds unowned session to whoever calls finalize
  status: "ready",
  prd_final: prdMarkdown,
});
```

**New**: Since real sessions are always owned from creation (Change 1), finalize no longer needs to set `user_id`. It only locks the PRD and transitions status. The ownership check is handled by `resolveSessionAccess`.

```js
buildSessionStore.updateSession(session.id, {
  status: "ready",
  prd_final: prdMarkdown,
});
```

### Change 4: OAuth grant recovery

**Current**: OAuth grants expire after 10 minutes. If the user takes longer, `createTargetRepo()` throws "No valid OAuth grant" with no recovery path.

**New**: When provisioning fails due to expired grant, return a structured error that the frontend can handle:

```js
{
  error: "oauth_grant_expired",
  message: "Your GitHub authorization has expired. Please re-authenticate.",
  action: "re_auth",
  returnTo: `/build/${sessionId}`
}
```

The frontend redirects to OAuth with `return_to` pointing back to the build status page. After re-auth, the grant is refreshed and provisioning can retry.

---

## Files Changed

| File | Change |
|------|--------|
| `console/routes/pub-build-session.js` | Add auth check to session creation, apply `resolveSessionAccess` to GET, message, finalize. Remove `user_id` binding from finalize. |
| `console/routes/pub-build-stream.js` | Apply `resolveSessionAccess` before SSE connection. |
| `console/routes/pub-provision.js` | Return structured error on expired OAuth grant. |
| `studio/app/build/page.tsx` | Check auth before creating real session. Show sign-in CTA if unauthenticated. Handle `oauth_grant_expired` error. |

4 files. No new files, no new abstractions.

---

## What Does NOT Change

- Demo session creation, reads, writes, streaming — all stay unauthenticated
- `enforceSessionBoundary()` — still prevents demo/real mixing
- Provision and start-build auth — already owner-gated
- OAuth flow (pub-auth.js) — no changes
- Auth store (auth-store.js) — no changes
- Database schema — no changes

---

## Tests Required

### New tests (in `console/test/pub-build-session.test.js` or similar)

1. **Real session creation without auth → 401**
2. **Real session creation with auth → 201 + session owned by authenticated user**
3. **Demo session creation without auth → 201** (unchanged behavior)
4. **GET real session as owner → 200 with session data**
5. **GET real session as non-owner → 404**
6. **GET real session without auth → 401**
7. **GET demo session without auth → 200** (unchanged behavior)
8. **POST message to real session as owner → 200**
9. **POST message to real session as non-owner → 404**
10. **POST message to real session without auth → 401**
11. **POST message to demo session without auth → 200** (unchanged behavior)
12. **SSE stream real session as owner → 200**
13. **SSE stream real session without auth → 401**
14. **Finalize real session as owner → 200**
15. **Finalize real session as non-owner → 404**
16. **Provision with expired OAuth grant → structured error with re-auth action**

### Existing tests to verify still pass

- `console/test/pub-provision.test.js` — ownership checks already tested
- `console/test/build-flow.test.tsx` — demo flow should be unaffected
- `studio/test/build-flow.test.tsx` — demo flow should be unaffected

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| User creates real session, auth cookie expires mid-chat | Next message returns 401. Frontend redirects to OAuth with `return_to`. After re-auth, session resumes (same user_id). |
| User shares build URL with someone else | Non-owner gets 404 on all endpoints. No information leak. |
| User opens `/build` in incognito (no cookie) | Shown "Sign in with GitHub" CTA. Demo still accessible via "Watch it build". |
| OAuth grant expires before provision | Structured error → frontend re-auth redirect → grant refreshed → retry provision. |
| User has two browser tabs on same session | Both tabs have same auth cookie → both work. No conflict. |
