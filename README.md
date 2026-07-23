# ChatClub

ChatClub is an invite-only, moderated classroom community for classmates to
communicate in a calmer, safer space.

This repository contains the Milestone 4 MVP architecture: a responsive React
client backed by Supabase authentication, Postgres persistence, row-level
authorization, and realtime updates. When backend credentials are absent, the app
shows setup guidance and retains an explicitly labelled interface demo.

## Product principles

- Membership is private and invite-only.
- A teacher or class admin moderates each classroom.
- Members can understand the rules and reach safety controls easily.
- Private information is never stored casually in the browser.
- Features ship only when their security and moderation model is clear.

## Current milestone

Milestone 4 adds private realtime conversation signals and one-to-one calls:

- Direct conversations show live presence and typing state through private
  Supabase Realtime channels.
- Persistent messages remain in Postgres and use WebSocket refresh hints for
  prompt delivery without treating ephemeral broadcasts as message storage.
- Direct classmates can start private one-to-one WebRTC audio/video calls.
- Calls join with the camera off, include explicit accept/decline controls, and
  stop local media when ended.
- Block rules are enforced when authorizing direct Realtime channels.
- Radix Dialog provides accessible focus and keyboard behavior for call prompts.

The demo composer remains deliberately non-functional. Connected environments use
the real backend; calling is therefore not shown in the interface demo.

## Supabase setup

1. Create a Supabase project.
2. Open the SQL editor and run
   [`supabase/migrations/001_chatclub_mvp.sql`](supabase/migrations/001_chatclub_mvp.sql).
   Then run
   [`supabase/migrations/002_harden_function_permissions.sql`](supabase/migrations/002_harden_function_permissions.sql).
   Then run
   [`supabase/migrations/003_safety_and_reliability.sql`](supabase/migrations/003_safety_and_reliability.sql).
   Then run
   [`supabase/migrations/004_direct_realtime_and_calls.sql`](supabase/migrations/004_direct_realtime_and_calls.sql).
3. Copy `.env.example` to `.env.local`.
4. Add the project URL and publishable/anonymous key:

   ```text
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-publishable-anon-key
   ```

5. Add `VITE_WEBRTC_ICE_SERVERS` as a JSON array. The checked-in example uses
   public STUN for development. Before classroom testing across different
   networks, configure a TURN service:

   ```text
   VITE_WEBRTC_ICE_SERVERS=[{"urls":"stun:stun.example.org:3478"},{"urls":"turn:turn.example.org:3478","username":"short-lived-user","credential":"short-lived-password"}]
   ```

   Static frontend variables are visible to users. Use short-lived TURN
   credentials in production; do not place a permanent TURN secret here.
6. In Supabase Authentication settings, configure the local and production site
   URLs. Keep email confirmation enabled for a real deployment.
7. Start the app and create the first classroom. The creator receives its
   one-time invitation code and becomes its moderator.

For GitHub Pages, add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and
`VITE_WEBRTC_ICE_SERVERS` as repository Actions secrets. The deployment workflow
injects them only while building the public frontend bundle.

Never put a Supabase service-role key in frontend environment variables. Only the
publishable/anonymous key belongs in the browser; authorization is enforced by
the migration's row-level security policies.

## Local development

Requires Node.js 20.19 or newer.

```bash
npm ci
npm start
```

Open `http://localhost:3000`.

## Quality checks

```bash
npm test -- --run
npm run build
npm run test:e2e
```

The browser suite uses Chromium's fake camera and microphone to complete a real
local WebRTC offer/answer and ICE negotiation. Before releasing calling to a
classroom, also test two physical devices on separate networks. If signaling is
live but the call cannot connect, verify that the configured ICE array includes
a reachable TURN server.

### Call acceptance check

1. Sign in as two members of the same classroom on separate devices.
2. Open the same direct conversation on both devices and confirm it shows
   `Live`.
3. Start, accept, and decline a call.
4. Verify two-way audio, then enable and disable each camera.
5. End the call from each side and confirm browser camera/microphone indicators
   turn off.
6. Repeat with one device on mobile data. A same-Wi-Fi success does not prove
   TURN connectivity.

## Repository workflow

`main` should be the source branch and GitHub Pages deployment target. Do not
commit `dist/`; the deployment workflow builds it from source. Pull requests
should pass tests and a production build before merging.

## Roadmap

1. **Milestone 1 — Foundation:** React architecture, documentation, tests, CI,
   responsive classroom prototype.
2. **Milestone 2 — Functional MVP:** real authentication, invitations, classroom
   membership, one-to-one and class chat, persistence, realtime updates, and
   basic moderation. **Implemented; requires a configured Supabase project.**
3. **Milestone 3 — Safety and reliability:** moderator report review, blocking,
   database rate limits, audit trails, failure recovery, backup operations,
   privacy documentation, and end-to-end tests. **Implemented; requires migration
   003 and operator backup configuration.**
4. **Milestone 4 — Expansion:** group conversations, notifications, scheduling,
   and a deliberate offline/PWA strategy. **In progress: private direct
   Realtime channels, presence, typing, and one-to-one WebRTC calling are
   implemented. Group calls remain deferred.**
