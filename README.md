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
- Direct classmates can start private one-to-one WebRTC audio/video calls through
  LiveKit's resilient media transport.
- Separate audio and video actions open a permission-aware pre-call lobby.
- Participant-only call history stores call metadata, never media or transcripts.
- People provides searchable classmate discovery with direct entry into private
  conversations.
- Updates appears as a pinned, read-only conversation rather than primary
  classroom administration.
- More groups safety and device-local incoming-call preferences.
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
   Then run
   [`supabase/migrations/005_call_history.sql`](supabase/migrations/005_call_history.sql).
3. Copy `.env.example` to `.env.local`.
4. Add the project URL and publishable/anonymous key:

   ```text
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-publishable-anon-key
   ```

5. In Supabase Authentication settings, configure the local and production site
   URLs. Keep email confirmation enabled for a real deployment.
6. Start the app and create the first classroom. The creator receives its
   one-time invitation code and becomes its moderator.

For GitHub Pages, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as
repository Actions secrets. The deployment workflow injects them only while
building the public frontend bundle.

Never put a Supabase service-role or LiveKit secret in frontend environment
variables. Only the
publishable/anonymous key belongs in the browser; authorization is enforced by
the migration's row-level security policies.

## Reliable calling setup

ChatClub uses the open-source LiveKit SDK instead of browser-to-browser media.
Supabase still handles private invitations; a Supabase Edge Function verifies
both classroom members and block rules before issuing a ten-minute LiveKit room
token.

1. Create a LiveKit Cloud project, or deploy the open-source LiveKit server with
   TURN/TLS enabled.
2. In the Supabase dashboard, open **Edge Functions → Secrets** and add:

   ```text
   LIVEKIT_URL=wss://your-project.livekit.cloud
   LIVEKIT_API_KEY=your-livekit-api-key
   LIVEKIT_API_SECRET=your-livekit-api-secret
   APP_ORIGIN=https://ephraimsupreeth.github.io
   ```

3. Deploy the checked-in token function:

   ```bash
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase functions deploy livekit-token
   ```

4. Do not add these LiveKit values to GitHub Actions or any `VITE_` variable.
   They are server secrets and must remain inside the Edge Function.

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

Before releasing calling to a classroom, test two physical devices on separate
networks. LiveKit Cloud provides managed TURN/TLS fallback. A self-hosted
deployment must explicitly enable TURN/TLS and expose the required ports.

### Call acceptance check

1. Sign in as two members of the same classroom on separate devices.
2. Open the same direct conversation on both devices and confirm it shows
   `Live`.
3. Select **Call** and approve the browser's one-time camera and microphone
   prompt. The pre-call lobby should immediately show a local preview and the
   real device names. Choose whether the microphone and camera should start on.
   No invitation is sent until **Start call** is selected. Repeat when accepting
   the incoming call.
4. Verify two-way audio, then enable and disable each camera.
5. Open **Settings** and switch between available microphones and cameras.
   Speaker selection appears only on browsers that support audio-output routing;
   otherwise use the device's system sound settings.
6. End the call from each side and confirm browser camera/microphone indicators
   turn off.
7. Repeat with one device on mobile data and switch between Wi-Fi and mobile
   data during the call to verify reconnection.

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
