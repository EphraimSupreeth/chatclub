import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getClassroomData,
  reportMessage,
  sendClassMessage,
  sendDirectMessage,
  signOut,
  subscribeToClassroom,
  muteMember,
  blockMember,
} from '../services/chatclubApi';
import ClassroomSidebar from './ClassroomSidebar';
import ChatPanel from './ChatPanel';
import CommunityPanel from './CommunityPanel';
import ModeratorPanel from './ModeratorPanel';

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
  });
  const [status, setStatus] = useState('Loading classroom…');
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

  const conversations = useMemo(
    () => [
      {
        id: 'class-chat',
        name: 'Class chat',
        detail: `${data.members.length} members`,
        initials: classroomRecord.name.slice(0, 3).toUpperCase(),
        unread: 0,
        kind: 'group',
      },
      ...data.members
        .filter((member) => member.user_id !== user.id)
        .map((member) => ({
          id: member.user_id,
          name: member.profile.display_name,
          detail: member.role === 'moderator' ? 'Moderator' : 'Class member',
          initials: member.profile.avatar_initials,
          unread: 0,
          kind: 'direct',
        })),
    ],
    [classroomRecord.name, data.members, user.id],
  );

  const activeConversation =
    conversations.find((conversation) => conversation.id === activeConversationId) ??
    conversations[0];

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
      text: message.body,
      time: new Date(message.created_at).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      }),
      moderator:
        data.members.find((member) => member.user_id === message.sender_id)?.role ===
        'moderator',
    }));

  async function handleSend(body) {
    if (activeConversation.id === 'class-chat') {
      await sendClassMessage(classroom.id, body);
    } else {
      await sendDirectMessage(classroom.id, activeConversation.id, body);
    }
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
      />
      {activeView === 'chat' ? (
        <ChatPanel
          classroom={classroom}
          currentUser={currentUser}
          conversations={conversations}
          activeConversation={activeConversation}
          messages={visibleMessages}
          onSelectConversation={setActiveConversationId}
          onSend={handleSend}
          onReport={handleReport}
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
