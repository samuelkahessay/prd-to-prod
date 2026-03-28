# Demo Capture Runbook

Updated: 2026-03-24

## Goal

Capture two canonical stills for the productized demo:

1. Factory-floor mid-sequence
2. Proof endcap after completion

The demo surface exposes stable capture markers:

- `data-capture="factory-floor"`
- `data-capture="proof-endcap"`
- `data-proof-ready="true"` once the proof endcap is live

## Local Startup

Start the console:

```bash
cd console
FRONTEND_URL=http://127.0.0.1:3001 node server.js
```

Start the web:

```bash
cd web
API_URL=http://127.0.0.1:3000 npm run dev -- --hostname 127.0.0.1 --port 3001
```

Open the demo entry:

```text
http://127.0.0.1:3001/demo?preset=recording
```

The page will create a demo session, provision automatically, and redirect into `/demo/:id`.

## Capture Cues

Factory-floor still:

- Wait for the beat line to mention review or merge.
- Capture the element marked `data-capture="factory-floor"`.

Proof still:

- Wait for `data-proof-ready="true"`.
- Capture the element marked `data-capture="proof-endcap"`.

## Reduced Motion Check

Before final capture, verify the same route with reduced motion enabled.

- The proof endcap should still appear.
- The factory floor may become less animated, but the proof path must remain intact.

## Output Path

Save reusable stills under:

```text
output/playwright/
```
