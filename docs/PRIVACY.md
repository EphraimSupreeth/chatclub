# ChatClub privacy and retention

This document describes the intended operating policy for a private classroom
deployment. The school or classroom operator must adapt it to local law and obtain
appropriate legal review before inviting minors.

## Data collected

ChatClub stores:

- account email address and display name;
- classroom membership and moderator role;
- class and direct messages;
- announcements;
- personal mute and block choices;
- reports submitted to moderators; and
- an audit trail of report review, member removal, and invitation rotation.

ChatClub does not need home addresses, telephone numbers, precise location,
advertising identifiers, or contact-list access. Members should never put this
information in messages.

## Visibility

- Classroom messages and membership are visible only to authorized classroom
  members.
- Direct messages are visible only to their sender and recipient.
- Reports are visible to the reporter and classroom moderators.
- Audit events are visible only to classroom moderators.
- Mutes and blocks are private to the member who created them.

Database row-level security is the enforcement boundary. Frontend visibility is
not treated as authorization.

## Retention

The database migration defines these targets:

- messages: 180 days;
- moderation audit events: 365 days;
- unresolved reports: retained until review and applicable school policy permits
  deletion;
- account and membership records: retained while the account/classroom is active.

The private `purge_expired_chatclub_data()` database function performs the message
and audit cleanup. It is not exposed to browser clients. An operator must schedule
it from a trusted database job after reviewing retention requirements.

## Audio and video calls

Call invitations are authorized through Supabase Realtime. Audio and video are
transported through the configured LiveKit deployment and are not stored by
ChatClub. Recording and streaming are not enabled. LiveKit receives the network
and media data required to connect the participants, so the school must review
the hosting region, retention terms, and data-processing agreement of its chosen
LiveKit Cloud account or self-hosted deployment before enabling calls.

Room tokens expire after ten minutes and are issued only after the server checks
that both participants are current classroom members and neither has blocked the
other. The LiveKit API secret remains in Supabase Edge Function secrets and is
never included in the browser bundle.

## Member rights and requests

The classroom operator must provide a channel for account access, correction,
export, and deletion requests. Deletion may be delayed when records must be
retained for an active safety investigation or legal requirement.

## Minors

Before real classroom use, the operator must establish:

- the applicable minimum age and parental/guardian consent process;
- who serves as moderator and their response responsibilities;
- how urgent safeguarding issues are escalated outside ChatClub;
- data-processing terms with Supabase, LiveKit, and any email provider; and
- a plain-language notice students can understand.

ChatClub reporting is not an emergency service.
