# Moderator security model

## Trust boundaries

- Supabase Auth proves account control.
- `private.platform_staff` determines platform staff authority.
- `public.classroom_members` determines access to a specific classroom.
- Private, security-definer database functions authorize privileged state
  changes. The browser never grants a role directly.
- Row-level security protects classroom data independently of UI visibility.

## Roles

### Super-admin

Can grant or revoke platform moderator status and assign approved staff to
classrooms. The first super-admin is provisioned out-of-band through the SQL
Editor. A super-admin cannot revoke their own access through the app.

### Platform moderator

Can create a classroom. This role alone does not permit access to every
classroom.

### Classroom moderator

Is an approved platform moderator assigned to one classroom. Can review reports,
remove students, and manage that classroom's enrollment code. A normal moderator
cannot remove another moderator.

### Student

Can enroll with a valid code and receives only the student role. Codes never
carry or select a role.

## Enrollment credential controls

- 128 bits of randomness from `pgcrypto.gen_random_bytes`.
- Bcrypt hash storage; plaintext is returned once.
- One active code per classroom.
- Configurable expiry from one hour to 30 days.
- Configurable limit from 1 to 500 successful enrollments.
- Atomic use counting under a row lock.
- Five failed attempts per authenticated account per 15 minutes.
- Generic invalid/expired response.
- Rotation after member removal and manual immediate revocation.

## Security invariants

1. Client-side state is never an authorization source.
2. Every privileged RPC rejects unauthenticated callers.
3. Staff functions deny access unless the caller is a super-admin.
4. Classroom functions check current classroom membership and staff status.
5. Revocation cannot leave a classroom without a moderator.
6. Private governance tables have no grants for browser roles.
7. Security-definer functions use an empty `search_path` and schema-qualified
   object names.
8. Sensitive state changes produce an audit event.

## Residual risks and production requirements

- Enable MFA for all staff accounts and require strong authentication policies.
- A shared class code can still be forwarded before it expires. Prefer small use
  limits and revoke it immediately after onboarding.
- Per-account rate limiting does not stop a distributed attack using many
  accounts. Add edge/WAF rate limiting and bot controls for an internet-scale
  deployment.
- Audit tables are not a tamper-proof external log. Export security events to a
  restricted logging service for higher assurance.
- Use separate super-admin accounts for administration and daily classroom use.
- Test authorization functions against a disposable Supabase project before
  applying the migration to production, and take a verified backup first.
