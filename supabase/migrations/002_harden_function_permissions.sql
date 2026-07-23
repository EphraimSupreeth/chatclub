-- Harden functions created by 001_chatclub_mvp.sql.
-- Internal trigger/RLS helpers belong outside the API-exposed public schema.

create schema if not exists private;

alter function public.handle_new_user() set schema private;
alter function public.is_classroom_member(uuid) set schema private;
alter function public.is_classroom_moderator(uuid) set schema private;
alter function public.shares_classroom_with(uuid) set schema private;

-- PostgreSQL grants EXECUTE to PUBLIC on new functions unless it is revoked.
revoke all on function private.handle_new_user() from public, anon, authenticated;
revoke all on function private.is_classroom_member(uuid) from public, anon, authenticated;
revoke all on function private.is_classroom_moderator(uuid) from public, anon, authenticated;
revoke all on function private.shares_classroom_with(uuid) from public, anon, authenticated;

-- RLS policies execute these helpers as signed-in users. The private schema is
-- not exposed by the Data API, so these cannot be called as /rest/v1/rpc/*.
grant usage on schema private to authenticated;
grant execute on function private.is_classroom_member(uuid) to authenticated;
grant execute on function private.is_classroom_moderator(uuid) to authenticated;
grant execute on function private.shares_classroom_with(uuid) to authenticated;

-- These are the only intentional client-callable SECURITY DEFINER functions.
-- They each reject missing auth.uid() and grant no access to the anon role.
revoke all on function public.create_classroom(text, text) from public, anon;
revoke all on function public.join_classroom(text) from public, anon;
grant execute on function public.create_classroom(text, text) to authenticated;
grant execute on function public.join_classroom(text) to authenticated;
