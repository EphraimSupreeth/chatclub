import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getClassroomData,
  reportMessage,
  sendClassMessage,
  sendDirectMessage,
  signOut,
  subscribeToClassroom,
  muteMember,
  blockMember,
  createCallHistory,
  updateCallHistory,
  addMessageMentions,
  setMessageReaction,
  markConversationRead,
  deleteAccount,
  updateProfile,
} from '../services/chatclubApi';
import ClassroomSidebar from './ClassroomSidebar';
import ChatPanel from './ChatPanel';
import CommunityPanel from './CommunityPanel';
import ModeratorPanel from './ModeratorPanel';
import useDirectRealtime from '../hooks/useDirectRealtime';
import usePeerCall from '../hooks/usePeerCall';
import CallsPanel from './CallsPanel';
import PeoplePanel from './PeoplePanel';
import MorePanel from './MorePanel';
import NotificationsPanel from './NotificationsPanel';

function toInitials(name = '') {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function LiveClassroom({ membership, user }) {
  const [activeView, setActiveView] = useState('chat');
  const [activeConversationId, setActiveConversationId] = useState('class-chat');
  const [data, setData] = useState({
    members: [],
    messages: [],
    announcements: [],
    mutedUserIds: [],
    blockedUserIds: [],
    calls: [],
    reads: [],
    reactions: [],
    mentions: [],
  });
  const [status, setStatus] = useState('Loading classroom…');
  const [notificationPreferences, setNotificationPreferences] = useState(() => {
    try {
      return {
        callSound: true,
        desktopNotifications: false,
        theme: 'system',
        textSize: 'medium',
        reducedMotion: false,
        mutedConversationIds: [],
        seenNotificationIds: [],
        ...JSON.parse(localStorage.getItem('chatclub-notification-preferences')),
      };
    } catch {
      return {
        callSound: true,
        desktopNotifications: false,
        theme: 'system',
        textSize: 'medium',
        reducedMotion: false,
        mutedConversationIds: [],
        seenNotificationIds: [],
      };
    }
  });
  const signalSenderRef = useRef(() =>
    Promise.reject(new Error('Open a direct conversation before calling.')),
  );
  const classroomRecord = membership.classroom;

  const loadData = useCallback(async () => {
    try {
      const nextData = await getClassroomData(classroomRecord.id);
      setData(nextData);
      setStatus('');
    } catch (error) {
      setStatus(error.message);
    }
  }, [classroomRecord.id]);

  useEffect(() => {
    loadData();
    return subscribeToClassroom(classroomRecord.id, loadData);
  }, [classroomRecord.id, loadData]);

  const currentMember = data.members.find((member) => member.user_id === user.id);
  const currentUser = {
    id: user.id,
    name: currentMember?.profile?.display_name ?? user.user_metadata?.display_name ?? user.email,
    initials: currentMember?.profile?.avatar_initials ?? toInitials(user.email),
    role: membership.role === 'moderator' ? 'Moderator' : 'Student',
    avatarTone: currentMember?.profile?.avatar_tone ?? 'blue',
  };

  const classroom = useMemo(
    () => ({
      id: classroomRecord.id,
      name: classroomRecord.name,
      school: classroomRecord.school_name,
      members: data.members.map((member) => ({
        id: member.user_id,
        name: member.profile.display_name,
        initials: member.profile.avatar_initials,
        role: member.role === 'moderator' ? 'Moderator' : 'Student',
        avatarTone: member.profile.avatar_tone ?? 'blue',
        online: false,
      })),
      announcements: data.announcements.map((announcement) => ({
        id: announcement.id,
        title: announcement.title,
        body: announcement.body,
        author: announcement.author.display_name,
        date: new Date(announcement.created_at).toLocaleDateString(),
      })),
    }),
    [classroomRecord, data.announcements, data.members],
  );

  const conversations = useMemo(() => {
    const readTimes = new Map(
      data.reads.map((read) => [read.conversation_key, new Date(read.read_at).getTime()]),
    );
    const unreadFor = (conversationId) => data.messages.filter((message) => {
      if (message.sender_id === user.id) return false;
      const belongs = conversationId === 'class-chat'
        ? message.recipient_id === null
        : message.sender_id === conversationId && message.recipient_id === user.id;
      return belongs && new Date(message.created_at).getTime() > (readTimes.get(conversationId) ?? 0);
    }).length;
    const mentionsFor = (conversationId) => data.mentions.filter((mention) => {
      if (mention.mentioned_user_id !== user.id) return false;
      const message = data.messages.find((item) => item.id === mention.message_id);
      if (!message) return false;
      const belongs = conversationId === 'class-chat'
        ? message.recipient_id === null
        : message.sender_id === conversationId && message.recipient_id === user.id;
      return belongs &&
        new Date(message.created_at).getTime() > (readTimes.get(conversationId) ?? 0);
    }).length;
    return [
      {
        id: 'class-chat',
        name: 'Class chat',
        detail: `${data.members.length} members`,
        initials: classroomRecord.name.slice(0, 3).toUpperCase(),
        unread: unreadFor('class-chat'),
        mentions: mentionsFor('class-chat'),
        kind: 'group',
      },
      ...data.members
        .filter((member) => member.user_id !== user.id)
        .map((member) => ({
          id: member.user_id,
          name: member.profile.display_name,
          detail: member.role === 'moderator' ? 'Moderator' : 'Class member',
          initials: member.profile.avatar_initials,
          avatarTone: member.profile.avatar_tone ?? 'blue',
          unread: unreadFor(member.user_id),
          mentions: mentionsFor(member.user_id),
          kind: 'direct',
        })),
    ];
  }, [classroomRecord.name, data.members, data.mentions, data.messages, data.reads, user.id]);

  const activeConversation =
    conversations.find((conversation) => conversation.id === activeConversationId) ??
    conversations[0];
  const activePeerId =
    activeConversation?.kind === 'direct' ? activeConversation.id : null;

  const sendSignal = useCallback(
    (event, payload) => signalSenderRef.current(event, payload),
    [],
  );
  const handleCallEvent = useCallback(async ({
    event,
    callId,
    mediaType,
    reason,
    connected,
  }) => {
    if (event === 'started') {
      await createCallHistory({
        callId,
        classroomId: classroom.id,
        callerId: user.id,
        recipientId: activePeerId,
        mediaType,
      });
    } else if (event === 'answered') {
      await updateCallHistory(callId, { answered_at: new Date().toISOString() });
    } else {
      const terminalStatus = event === 'failed'
        ? 'failed'
        : connected
          ? 'completed'
          : reason === 'unanswered'
            ? 'missed'
            : reason === 'declined'
              ? 'declined'
              : reason === 'cancelled'
                ? 'cancelled'
                : 'failed';
      await updateCallHistory(callId, {
        status: terminalStatus,
        ended_at: new Date().toISOString(),
      });
    }
    await loadData();
  }, [activePeerId, classroom.id, loadData, user.id]);
  const call = usePeerCall({
    sendSignal,
    peerName: activeConversation?.name ?? 'Class member',
    classroomId: classroom.id,
    peerUserId: activePeerId,
    onCallEvent: handleCallEvent,
  });
  const directRealtime = useDirectRealtime({
    classroomId: classroom.id,
    currentUserId: user.id,
    peerUserId: activePeerId,
    onMessageChanged: loadData,
    onSignal: call.handleSignal,
  });
  signalSenderRef.current = directRealtime.send;

  useEffect(() => {
    localStorage.setItem(
      'chatclub-notification-preferences',
      JSON.stringify(notificationPreferences),
    );
  }, [notificationPreferences]);

  useEffect(() => {
    document.documentElement.dataset.theme = notificationPreferences.theme;
    document.documentElement.dataset.textSize = notificationPreferences.textSize;
    document.documentElement.dataset.reducedMotion =
      notificationPreferences.reducedMotion ? 'true' : 'false';
  }, [
    notificationPreferences.reducedMotion,
    notificationPreferences.textSize,
    notificationPreferences.theme,
  ]);

  useEffect(() => {
    if (call.status !== 'incoming') return undefined;
    if (
      notificationPreferences.desktopNotifications &&
      document.hidden &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      new Notification('New ChatClub activity', {
        body: 'Open ChatClub to view it.',
      });
    }
    if (!notificationPreferences.callSound) return undefined;
    let context;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return undefined;
      context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 520;
      gain.gain.value = 0.045;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.28);
    } catch {
      // Some browsers require another user gesture before playing alert audio.
    }
    return () => void context?.close();
  }, [
    activeConversation.name,
    call.mediaType,
    call.status,
    notificationPreferences.callSound,
    notificationPreferences.desktopNotifications,
  ]);

  useEffect(() => {
    if (call.status !== 'idle') call.endCall('conversation-changed');
    // Ending an active call is intentional when its private conversation changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePeerId]);

  const visibleMessages = data.messages
    .filter((message) => {
      if (
        data.mutedUserIds.includes(message.sender_id) ||
        data.blockedUserIds.includes(message.sender_id)
      ) return false;
      if (activeConversation.id === 'class-chat') return message.recipient_id === null;
      return (
        (message.sender_id === user.id && message.recipient_id === activeConversation.id) ||
        (message.sender_id === activeConversation.id && message.recipient_id === user.id)
      );
    })
    .map((message) => ({
      id: message.id,
      authorId: message.sender_id,
      author: message.sender.display_name,
      initials: message.sender.avatar_initials,
      avatarTone: data.members.find(
        (member) => member.user_id === message.sender_id,
      )?.profile?.avatar_tone,
      text: message.body,
      time: new Date(message.created_at).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      }),
      moderator:
        data.members.find((member) => member.user_id === message.sender_id)?.role ===
        'moderator',
      mentionedCurrentUser: data.mentions.some(
        (mention) =>
          mention.message_id === message.id && mention.mentioned_user_id === user.id,
      ),
      reactions: data.reactions
        .filter((reaction) => reaction.message_id === message.id)
        .reduce((groups, reaction) => {
          const group = groups.find((item) => item.emoji === reaction.emoji);
          if (group) {
            group.count += 1;
            if (reaction.user_id === user.id) group.mine = true;
          } else {
            groups.push({
              emoji: reaction.emoji,
              count: 1,
              mine: reaction.user_id === user.id,
            });
          }
          return groups;
        }, []),
    }));

  const notifications = useMemo(() => {
    const items = [];
    conversations.forEach((conversation) => {
      if (!conversation.unread) return;
      if (notificationPreferences.mutedConversationIds.includes(conversation.id)) return;
      items.push({
        id: `conversation-${conversation.id}`,
        type: 'conversation',
        conversationId: conversation.id,
        initials: conversation.initials,
        tone: conversation.avatarTone,
        title: conversation.mentions
          ? `${conversation.mentions} new mention${conversation.mentions === 1 ? '' : 's'}`
          : `${conversation.unread} unread message${conversation.unread === 1 ? '' : 's'}`,
        description: `Open ${conversation.name}`,
        createdAt: data.messages
          .filter((message) => conversation.id === 'class-chat'
            ? message.recipient_id === null
            : message.sender_id === conversation.id && message.recipient_id === user.id)
          .at(-1)?.created_at ?? new Date().toISOString(),
      });
    });
    data.calls
      .filter((item) =>
        item.recipient_id === user.id &&
        item.status === 'missed' &&
        !notificationPreferences.seenNotificationIds.includes(`call-${item.id}`))
      .forEach((item) => items.push({
        id: `call-${item.id}`,
        type: 'call',
        conversationId: item.caller_id,
        initials: item.caller?.avatar_initials ?? '?',
        title: 'Missed call',
        description: `From ${item.caller?.display_name ?? 'a class member'}`,
        createdAt: item.started_at,
      }));
    return items.sort(
      (first, second) => new Date(second.createdAt) - new Date(first.createdAt),
    );
  }, [
    conversations,
    data.calls,
    data.messages,
    notificationPreferences.mutedConversationIds,
    notificationPreferences.seenNotificationIds,
    user.id,
  ]);

  const knownMessageIdsRef = useRef(null);
  useEffect(() => {
    const currentIds = new Set(data.messages.map((message) => message.id));
    const previousIds = knownMessageIdsRef.current;
    knownMessageIdsRef.current = currentIds;
    if (!previousIds || !document.hidden) return;
    const incoming = data.messages.find(
      (message) => !previousIds.has(message.id) && message.sender_id !== user.id,
    );
    if (!incoming) return;
    const conversationId = incoming.recipient_id === null
      ? 'class-chat'
      : incoming.sender_id;
    if (notificationPreferences.mutedConversationIds.includes(conversationId)) return;
    if (
      notificationPreferences.desktopNotifications &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      new Notification('New ChatClub activity', {
        body: 'Open ChatClub to view it.',
      });
    }
  }, [
    data.messages,
    notificationPreferences.desktopNotifications,
    notificationPreferences.mutedConversationIds,
    user.id,
  ]);

  useEffect(() => {
    if (activeView !== 'chat' || !activeConversation) return;
    const latestMessage = visibleMessages.at(-1);
    if (!latestMessage) return;
    const currentRead = data.reads.find(
      (read) => read.conversation_key === activeConversation.id,
    );
    if (
      currentRead &&
      new Date(currentRead.read_at).getTime() >=
        new Date(data.messages.find((message) => message.id === latestMessage.id)?.created_at).getTime()
    ) return;
    const readAt = new Date().toISOString();
    setData((current) => ({
      ...current,
      reads: [
        ...current.reads.filter(
          (read) => read.conversation_key !== activeConversation.id,
        ),
        { conversation_key: activeConversation.id, read_at: readAt },
      ],
    }));
    markConversationRead(classroom.id, activeConversation.id).catch(() => {});
  }, [
    activeConversation,
    activeView,
    classroom.id,
    data.messages,
    data.reads,
    visibleMessages,
  ]);

  async function handleSend(body) {
    let sentMessage;
    if (activeConversation.id === 'class-chat') {
      sentMessage = await sendClassMessage(classroom.id, body);
    } else {
      sentMessage = await sendDirectMessage(classroom.id, activeConversation.id, body);
      await directRealtime.send('message-changed', {});
    }
    const mentionedUserIds = data.members
      .filter((member) => body.includes(`@${member.profile.display_name}`))
      .map((member) => member.user_id);
    if (sentMessage?.id && mentionedUserIds.length) {
      await addMessageMentions(sentMessage.id, mentionedUserIds);
    }
    await loadData();
  }

  async function handleReaction(messageId, emoji, active) {
    await setMessageReaction({ messageId, emoji, active });
    await loadData();
  }

  async function handleReport(messageId, reason) {
    await reportMessage({ classroomId: classroom.id, messageId, reason });
  }

  async function handleMute(mutedUserId) {
    await muteMember({ classroomId: classroom.id, mutedUserId });
    await loadData();
  }

  async function handleBlock(blockedUserId) {
    await blockMember({ classroomId: classroom.id, blockedUserId });
    if (activeConversationId === blockedUserId) setActiveConversationId('class-chat');
    await loadData();
  }

  if (status) {
    return <main className="loading-page"><p>{status}</p></main>;
  }

  return (
    <main className="app-shell">
      <ClassroomSidebar
        classroom={classroom}
        currentUser={currentUser}
        activeView={activeView}
        onSelectView={setActiveView}
        onLeave={signOut}
        notificationCount={notifications.length}
      />
      {activeView === 'chat' ? (
        <ChatPanel
          classroom={classroom}
          currentUser={currentUser}
          conversations={conversations}
          activeConversation={activeConversation}
          messages={visibleMessages}
          peerOnline={directRealtime.peerOnline}
          peerTyping={directRealtime.peerTyping}
          realtimeConnected={directRealtime.connected}
          call={call}
          canCall={
            Boolean(activePeerId) &&
            directRealtime.connected &&
            !data.blockedUserIds.includes(activePeerId)
          }
          onSelectConversation={setActiveConversationId}
          onSend={handleSend}
          onReport={handleReport}
          onReact={handleReaction}
          mentionableMembers={classroom.members.filter((member) => member.id !== user.id)}
          onTyping={(active) => directRealtime.send('typing', { active })}
          onOpenUpdates={() => setActiveView('announcements')}
          conversationMuted={notificationPreferences.mutedConversationIds.includes(
            activeConversation.id,
          )}
          onToggleConversationMute={() => setNotificationPreferences((current) => ({
            ...current,
            mutedConversationIds: current.mutedConversationIds.includes(activeConversation.id)
              ? current.mutedConversationIds.filter((id) => id !== activeConversation.id)
              : [...current.mutedConversationIds, activeConversation.id],
          }))}
        />
      ) : activeView === 'calls' ? (
        <CallsPanel
          calls={data.calls}
          currentUserId={user.id}
          onOpenConversation={(peerId) => {
            setActiveConversationId(peerId);
            setActiveView('chat');
          }}
        />
      ) : activeView === 'people' ? (
        <PeoplePanel
          members={classroom.members}
          currentUserId={user.id}
          availableUserIds={[
            user.id,
            ...(activePeerId && directRealtime.peerOnline ? [activePeerId] : []),
          ]}
          onOpenConversation={(peerId) => {
            setActiveConversationId(peerId);
            setActiveView('chat');
          }}
        />
      ) : activeView === 'notifications' ? (
        <NotificationsPanel
          notifications={notifications}
          onOpen={(notification) => {
            if (notification.type === 'call') {
              setNotificationPreferences((current) => ({
                ...current,
                seenNotificationIds: [...current.seenNotificationIds, notification.id],
              }));
            }
            setActiveConversationId(notification.conversationId);
            setActiveView('chat');
          }}
        />
      ) : activeView === 'more' ? (
        <MorePanel
          preferences={notificationPreferences}
          onChangePreferences={setNotificationPreferences}
          onNavigate={setActiveView}
          onSignOut={signOut}
          onDeleteAccount={deleteAccount}
          currentUser={currentUser}
          onUpdateProfile={async (profile) => {
            await updateProfile(profile);
            await loadData();
          }}
        />
      ) : activeView === 'moderation' ? (
        <ModeratorPanel
          classroom={classroom}
          currentUserId={user.id}
          onClassroomChanged={loadData}
        />
      ) : (
        <CommunityPanel
          view={activeView}
          classroom={classroom}
          currentUserId={user.id}
          onMute={handleMute}
          onBlock={handleBlock}
          live
        />
      )}
    </main>
  );
}

export default LiveClassroom;
