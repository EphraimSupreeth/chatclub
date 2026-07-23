import { supabase } from '../lib/supabase';

function requireClient() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

function throwOnError(result) {
  if (result.error) throw result.error;
  return result.data;
}

export async function signUp({ name, email, password }) {
  const client = requireClient();
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { data: { display_name: name } },
  });
  if (error) throw error;
  return data;
}

export async function signIn({ email, password }) {
  return throwOnError(
    await requireClient().auth.signInWithPassword({ email, password }),
  );
}

export async function signOut() {
  return throwOnError(await requireClient().auth.signOut());
}

export async function getSession() {
  return throwOnError(await requireClient().auth.getSession());
}

export function onAuthStateChange(callback) {
  return requireClient().auth.onAuthStateChange((_event, session) => callback(session));
}

export async function listClassrooms() {
  return (
    throwOnError(
      await requireClient()
        .from('classroom_members')
        .select('role, classroom:classrooms(id, name, school_name, created_at)')
        .order('joined_at', { ascending: true }),
    ) ?? []
  );
}

export async function joinClassroom(code) {
  return throwOnError(
    await requireClient().rpc('join_classroom', { class_code: code.trim() }),
  );
}

export async function createClassroom({ name, schoolName }) {
  const data = throwOnError(
    await requireClient().rpc('create_classroom', {
      classroom_name: name.trim(),
      classroom_school_name: schoolName.trim(),
    }),
  );
  return data?.[0];
}

export async function getClassroomData(classroomId) {
  const client = requireClient();
  const [membersResult, messagesResult, announcementsResult, mutesResult] = await Promise.all([
    client
      .from('classroom_members')
      .select('user_id, role, joined_at, profile:profiles(id, display_name, avatar_initials)')
      .eq('classroom_id', classroomId)
      .order('joined_at'),
    client
      .from('messages')
      .select('id, body, created_at, sender_id, recipient_id, sender:profiles!messages_sender_id_fkey(display_name, avatar_initials)')
      .eq('classroom_id', classroomId)
      .order('created_at', { ascending: true })
      .limit(100),
    client
      .from('announcements')
      .select('id, title, body, created_at, author:profiles!announcements_author_id_fkey(display_name)')
      .eq('classroom_id', classroomId)
      .order('created_at', { ascending: false }),
    client
      .from('member_mutes')
      .select('muted_user_id')
      .eq('classroom_id', classroomId),
  ]);

  return {
    members: throwOnError(membersResult) ?? [],
    messages: throwOnError(messagesResult) ?? [],
    announcements: throwOnError(announcementsResult) ?? [],
    mutedUserIds: (throwOnError(mutesResult) ?? []).map((mute) => mute.muted_user_id),
  };
}

export async function sendClassMessage(classroomId, body) {
  return throwOnError(
    await requireClient()
      .from('messages')
      .insert({ classroom_id: classroomId, body: body.trim() })
      .select('id')
      .single(),
  );
}

export async function sendDirectMessage(classroomId, recipientId, body) {
  return throwOnError(
    await requireClient()
      .from('messages')
      .insert({
        classroom_id: classroomId,
        recipient_id: recipientId,
        body: body.trim(),
      })
      .select('id')
      .single(),
  );
}

export async function reportMessage({ classroomId, messageId, reason }) {
  return throwOnError(
    await requireClient()
      .from('reports')
      .insert({
        classroom_id: classroomId,
        message_id: messageId,
        reason: reason.trim(),
      })
      .select('id')
      .single(),
  );
}

export async function muteMember({ classroomId, mutedUserId }) {
  return throwOnError(
    await requireClient().from('member_mutes').upsert({
      classroom_id: classroomId,
      muted_user_id: mutedUserId,
    }),
  );
}

export function subscribeToClassroom(classroomId, onChange) {
  const client = requireClient();
  const channel = client
    .channel(`classroom:${classroomId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `classroom_id=eq.${classroomId}`,
      },
      onChange,
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'announcements',
        filter: `classroom_id=eq.${classroomId}`,
      },
      onChange,
    )
    .subscribe();

  return () => client.removeChannel(channel);
}
