import { supabase } from '../lib/supabase';

function requireClient() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

function throwOnError(result) {
  if (result.error) throw result.error;
  return result.data;
}

function optionalMigrationRows(result) {
  if (!result.error) return result.data ?? [];
  if (['42P01', 'PGRST205'].includes(result.error.code)) return [];
  throw result.error;
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
  return throwOnError(await requireClient().auth.signOut({ scope: 'global' }));
}

export async function deleteAccount(password) {
  const { data, error } = await requireClient().functions.invoke('delete-account', {
    body: { password },
  });
  if (error) {
    let message = error.message;
    try {
      const body = await error.context?.json();
      if (body?.error) message = body.error;
    } catch {
      // Preserve the client error when the response is not JSON.
    }
    throw new Error(message);
  }
  return data;
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
  const [
    membersResult,
    messagesResult,
    announcementsResult,
    mutesResult,
    blocksResult,
    callsResult,
    readsResult,
    reactionsResult,
    mentionsResult,
  ] = await Promise.all([
    client
      .from('classroom_members')
      .select('user_id, role, joined_at, profile:profiles(id, display_name, avatar_initials, avatar_tone)')
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
    client
      .from('member_blocks')
      .select('blocked_user_id')
      .eq('classroom_id', classroomId),
    client
      .from('call_history')
      .select(`
        id,
        call_id,
        caller_id,
        recipient_id,
        media_type,
        status,
        started_at,
        answered_at,
        ended_at,
        caller:profiles!call_history_caller_id_fkey(display_name, avatar_initials),
        recipient:profiles!call_history_recipient_id_fkey(display_name, avatar_initials)
      `)
      .eq('classroom_id', classroomId)
      .order('started_at', { ascending: false })
      .limit(50),
    client
      .from('conversation_reads')
      .select('conversation_key, read_at')
      .eq('classroom_id', classroomId),
    client
      .from('message_reactions')
      .select('message_id, user_id, emoji'),
    client
      .from('message_mentions')
      .select('message_id, mentioned_user_id'),
  ]);

  return {
    members: throwOnError(membersResult) ?? [],
    messages: throwOnError(messagesResult) ?? [],
    announcements: throwOnError(announcementsResult) ?? [],
    mutedUserIds: (throwOnError(mutesResult) ?? []).map((mute) => mute.muted_user_id),
    blockedUserIds: optionalMigrationRows(blocksResult).map((block) => block.blocked_user_id),
    calls: optionalMigrationRows(callsResult),
    reads: optionalMigrationRows(readsResult),
    reactions: optionalMigrationRows(reactionsResult),
    mentions: optionalMigrationRows(mentionsResult),
  };
}

export async function createCallHistory({
  callId,
  classroomId,
  callerId,
  recipientId,
  mediaType,
}) {
  return throwOnError(
    await requireClient()
      .from('call_history')
      .insert({
        call_id: callId,
        classroom_id: classroomId,
        caller_id: callerId,
        recipient_id: recipientId,
        media_type: mediaType,
      })
      .select('id')
      .single(),
  );
}

export async function updateCallHistory(callId, changes) {
  return throwOnError(
    await requireClient()
      .from('call_history')
      .update(changes)
      .eq('call_id', callId),
  );
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

export async function addMessageMentions(messageId, mentionedUserIds) {
  if (!mentionedUserIds.length) return [];
  return throwOnError(
    await requireClient().from('message_mentions').insert(
      mentionedUserIds.map((mentionedUserId) => ({
        message_id: messageId,
        mentioned_user_id: mentionedUserId,
      })),
    ),
  );
}

export async function setMessageReaction({ messageId, emoji, active }) {
  const client = requireClient();
  if (active) {
    return throwOnError(
      await client.from('message_reactions').insert({ message_id: messageId, emoji }),
    );
  }
  return throwOnError(
    await client
      .from('message_reactions')
      .delete()
      .eq('message_id', messageId)
      .eq('emoji', emoji),
  );
}

export async function markConversationRead(classroomId, conversationKey) {
  return throwOnError(
    await requireClient().from('conversation_reads').upsert({
      classroom_id: classroomId,
      conversation_key: conversationKey,
      read_at: new Date().toISOString(),
    }),
  );
}

export async function updateProfile({ displayName, avatarTone }) {
  const client = requireClient();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error('Your session has expired.');
  return throwOnError(
    await client
      .from('profiles')
      .update({
        display_name: displayName.trim(),
        avatar_tone: avatarTone,
      })
      .eq('id', userData.user.id)
      .select('display_name, avatar_initials, avatar_tone')
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

export async function blockMember({ classroomId, blockedUserId }) {
  return throwOnError(
    await requireClient().from('member_blocks').upsert({
      classroom_id: classroomId,
      blocked_user_id: blockedUserId,
    }),
  );
}

export async function listModeratorData(classroomId) {
  const client = requireClient();
  const [reportsResult, auditsResult] = await Promise.all([
    client
      .from('reports')
      .select(`
        id,
        reason,
        status,
        created_at,
        message_id,
        reporter:profiles!reports_reporter_id_fkey(display_name),
        message:messages(body, sender:profiles!messages_sender_id_fkey(display_name))
      `)
      .eq('classroom_id', classroomId)
      .order('created_at', { ascending: false }),
    client
      .from('audit_events')
      .select('id, action, created_at, metadata, actor:profiles!audit_events_actor_id_fkey(display_name)')
      .eq('classroom_id', classroomId)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  return {
    reports: throwOnError(reportsResult) ?? [],
    auditEvents: throwOnError(auditsResult) ?? [],
  };
}

export async function resolveReport(reportId, resolution) {
  return throwOnError(
    await requireClient().rpc('resolve_report', {
      target_report_id: reportId,
      resolution,
    }),
  );
}

export async function removeClassroomMember(classroomId, userId) {
  return throwOnError(
    await requireClient().rpc('remove_classroom_member', {
      target_classroom_id: classroomId,
      target_user_id: userId,
    }),
  );
}

export async function rotateClassroomInvite(classroomId) {
  return throwOnError(
    await requireClient().rpc('rotate_classroom_invite', {
      target_classroom_id: classroomId,
    }),
  );
}

export async function getLiveKitCallToken({
  classroomId,
  peerUserId,
  callId,
}) {
  const { data, error } = await requireClient().functions.invoke(
    'livekit-token',
    {
      body: {
        classroomId,
        peerUserId,
        callId,
      },
    },
  );
  if (error) {
    let message = error.message;
    try {
      const body = await error.context?.json();
      if (body?.error) message = body.error;
    } catch {
      // Preserve the Supabase client error when the response is not JSON.
    }
    throw new Error(message);
  }
  if (!data?.token || !data?.url) {
    throw new Error('Calling service is not configured.');
  }
  return data;
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
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'call_history',
        filter: `classroom_id=eq.${classroomId}`,
      },
      onChange,
    )
    .subscribe();

  return () => client.removeChannel(channel);
}

function directTopic(classroomId, firstUserId, secondUserId) {
  const participants = [firstUserId, secondUserId].sort();
  return `direct:${classroomId}:${participants[0]}:${participants[1]}`;
}

export function connectDirectConversation({
  classroomId,
  currentUserId,
  peerUserId,
  onBroadcast,
  onPresence,
  onStatus,
}) {
  const client = requireClient();
  const channel = client.channel(
    directTopic(classroomId, currentUserId, peerUserId),
    {
      config: {
        private: true,
        broadcast: { ack: true, self: false },
        presence: { key: currentUserId },
      },
    },
  );

  channel
    .on('broadcast', { event: '*' }, ({ event, payload }) => {
      if (payload?.to === currentUserId && payload?.from === peerUserId) {
        onBroadcast?.(event, payload);
      }
    })
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      onPresence?.(Boolean(state[peerUserId]?.length));
    })
    .subscribe(async (status) => {
      onStatus?.(status);
      if (status === 'SUBSCRIBED') {
        await channel.track({
          user_id: currentUserId,
          online_at: new Date().toISOString(),
        });
      }
    });

  return {
    send(event, payload = {}) {
      return channel.send({
        type: 'broadcast',
        event,
        payload: {
          ...payload,
          from: currentUserId,
          to: peerUserId,
        },
      });
    },
    disconnect() {
      return client.removeChannel(channel);
    },
  };
}
