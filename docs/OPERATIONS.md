# ChatClub operations runbook

## Deployments

The `Test and deploy ChatClub` GitHub Actions workflow runs unit tests, the
production build, and browser tests before deploying GitHub Pages. Production
Supabase credentials are injected only into the deployment build.

## Database migrations

Apply migrations in numeric order through the Supabase SQL Editor. Record the
date, operator, project, and outcome. Never edit a migration already applied to a
shared project; create the next numbered migration.

Milestone 3 requires:

```text
supabase/migrations/003_safety_and_reliability.sql
```

Apply this migration before deploying the matching frontend because the frontend
queries the new `member_blocks` and `audit_events` tables.

Milestone 4 also requires migration 004 and the `livekit-token` Edge Function:

```text
supabase/migrations/004_direct_realtime_and_calls.sql
supabase/functions/livekit-token
```

## Calling service

The `livekit-token` Edge Function is the authorization boundary for calls.
Configure `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, and
`APP_ORIGIN` as Supabase Edge Function secrets, then deploy the function.

Monitor LiveKit connection failures and regional availability. For self-hosted
LiveKit, expose UDP media ports and enable TURN/TLS on port 443 for restrictive
school and mobile networks. Never enable recording without a separate consent,
retention, moderator-access, and incident-response design.

After every media-service configuration change, complete the two-device
acceptance check in the README using both Wi-Fi and mobile data.

## Backup and recovery

Supabase backup availability and point-in-time recovery depend on the project
plan. Before classroom onboarding:

1. Confirm the project backup schedule in Supabase.
2. Document the available restore point objective and recovery time objective.
3. Test a restore into a separate project.
4. Keep migrations in Git as the schema recovery source.
5. Do not export authentication data to personal devices.

## Retention job

After legal/policy review, schedule this private function from a trusted
Postgres job:

```sql
select * from private.purge_expired_chatclub_data();
```

Never grant browser roles permission to execute it.

## Incident response

1. Preserve relevant report and audit identifiers.
2. Remove or block access when necessary.
3. Rotate the classroom invitation code.
4. Revoke exposed API credentials immediately.
5. Review Supabase Auth and Postgres logs.
6. Notify the school safeguarding owner and affected people according to policy.
7. Document cause, impact, decisions, and corrective actions.

## Monitoring

Review at least weekly during active use:

- unresolved reports;
- authentication errors and unusual signup volume;
- rate-limit errors;
- database size and backup status;
- Supabase Security Advisor findings; and
- failed GitHub Actions deployments.
