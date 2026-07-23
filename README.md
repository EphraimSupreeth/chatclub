# ChatClub

ChatClub is an invite-only, moderated classroom community for classmates to
communicate in a calmer, safer space.

This repository contains the Milestone 2 MVP architecture: a responsive React
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

Milestone 2 adds the functional backend contract:

- Email/password accounts are handled by Supabase Auth.
- Classrooms are created by moderators and joined with hashed invitation codes.
- Postgres row-level security limits classroom data to authorized members.
- Class and one-to-one messages are persistent and delivered through Supabase
  Realtime.
- Members can mute classmates and privately report messages to moderators.
- Announcements can only be created by moderators at the database layer.

The demo composer remains deliberately non-functional. Connected environments use
the real backend.

## Supabase setup

1. Create a Supabase project.
2. Open the SQL editor and run
   [`supabase/migrations/001_chatclub_mvp.sql`](supabase/migrations/001_chatclub_mvp.sql).
   Then run
   [`supabase/migrations/002_harden_function_permissions.sql`](supabase/migrations/002_harden_function_permissions.sql).
   Then run
   [`supabase/migrations/003_safety_and_reliability.sql`](supabase/migrations/003_safety_and_reliability.sql).
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
   and a deliberate offline/PWA strategy.
