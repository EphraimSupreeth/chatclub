import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import Avatar from './Avatar';
import CallExperience from './CallExperience';

function ReactionIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="12" r="7.5" />
      <path d="M8.3 10h.01M13.7 10h.01M8.2 14.2c.8 1 1.7 1.5 2.8 1.5s2-.5 2.8-1.5M19 5v6M16 8h6" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </svg>
  );
}

function ReportIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3l7 3v5c0 4.6-2.7 7.8-7 10-4.3-2.2-7-5.4-7-10V6zM12 8v5M12 16h.01" />
    </svg>
  );
}

function ChatPanel({
  classroom,
  currentUser,
  conversations,
  activeConversation,
  messages,
  peerOnline = false,
  peerTyping = false,
  realtimeConnected = false,
  call,
  canCall = false,
  onSelectConversation,
  onSend,
  onReport,
  onReact,
  mentionableMembers = [],
  onTyping,
  onOpenUpdates,
  conversationMuted = false,
  onToggleConversationMute,
}) {
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState('');
  const [sending, setSending] = useState(false);
  const typingTimerRef = useRef(null);
  const typingActiveRef = useRef(false);
  const mentionMatch = draft.match(/(?:^|\s)@([^@\s]*)$/);
  const mentionSuggestions = mentionMatch
    ? mentionableMembers
      .filter((member) =>
        member.name.toLowerCase().startsWith(mentionMatch[1].toLowerCase()),
      )
      .slice(0, 5)
    : [];

  useEffect(() => () => window.clearTimeout(typingTimerRef.current), []);

  function updateTyping(nextDraft) {
    if (!onTyping) return;
    window.clearTimeout(typingTimerRef.current);
    const isTyping = Boolean(nextDraft.trim());
    if (isTyping && !typingActiveRef.current) {
      typingActiveRef.current = true;
      onTyping(true).catch(() => {});
    }
    if (!isTyping && typingActiveRef.current) {
      typingActiveRef.current = false;
      onTyping(false).catch(() => {});
      return;
    }
    if (isTyping) {
      typingTimerRef.current = window.setTimeout(() => {
        typingActiveRef.current = false;
        onTyping(false).catch(() => {});
      }, 1800);
    }
  }

  async function handleSend(event) {
    event.preventDefault();
    if (!draft.trim()) return;
    if (!onSend) {
      setNotice('Demo only — messages are not sent or stored.');
      return;
    }
    setSending(true);
    setNotice('');
    try {
      await onSend(draft);
      // Typing is an optional realtime hint. A stalled WebSocket acknowledgement
      // must never delay or make a successfully persisted message look failed.
      onTyping?.(false).catch(() => {});
      typingActiveRef.current = false;
      window.clearTimeout(typingTimerRef.current);
      setDraft('');
    } catch (error) {
      setNotice(error.message);
    } finally {
      setSending(false);
    }
  }

  async function handleReport(messageId) {
    const reason = window.prompt('Briefly explain why this message should be reviewed.');
    if (!reason?.trim()) return;
    try {
      await onReport(messageId, reason);
      setNotice('Report sent privately to the classroom moderators.');
    } catch (error) {
      setNotice(error.message);
    }
  }

  function insertMention(name) {
    setDraft((current) =>
      current.replace(/(?:^|\s)@([^@\s]*)$/, (match) => {
        const prefix = match.startsWith(' ') ? ' ' : '';
        return `${prefix}@${name} `;
      }),
    );
  }

  async function handleReaction(messageId, emoji, active) {
    try {
      await onReact(messageId, emoji, active);
    } catch (error) {
      setNotice(error.message);
    }
  }

  return (
    <section className="chat-layout" aria-label="Messages">
      <aside className="conversation-list">
        <div className="conversation-list__context">
          <span className="conversation-list__class-mark">
            {classroom.name.slice(0, 2).toUpperCase()}
          </span>
          <span>
            <strong>{classroom.name}</strong>
            <small>{classroom.school}</small>
          </span>
        </div>
        <div className="conversation-list__header">
          <span className="eyebrow">Your conversations</span>
          <h1>Chats</h1>
          <p>Pick up where you left off.</p>
        </div>
        <div className="conversation-items">
          {onOpenUpdates && (
            <button
              type="button"
              className="conversation-card conversation-card--updates"
              onClick={onOpenUpdates}
            >
              <span className="conversation-updates-icon" aria-hidden="true">◁</span>
              <span className="conversation-card__copy">
                <strong>Updates</strong>
                <small>{classroom.announcements.length
                  ? classroom.announcements[0].title
                  : 'No new updates'}</small>
              </span>
            </button>
          )}
          {conversations.map((conversation, index) => (
            <button
              type="button"
              className={
                activeConversation.id === conversation.id
                  ? 'conversation-card conversation-card--active'
                  : 'conversation-card'
              }
              key={conversation.id}
              onClick={() => onSelectConversation(conversation.id)}
            >
              <Avatar
                initials={conversation.initials}
                tone={conversation.avatarTone || (index % 2 === 0 ? 'blue' : 'peach')}
              />
              <span className="conversation-card__copy">
                <strong>{conversation.name}</strong>
                <small>{conversation.detail}</small>
              </span>
              {conversation.unread > 0 && (
                <span className="unread-count" aria-label={`${conversation.unread} unread`}>
                  {conversation.mentions > 0 ? `@ ${conversation.unread}` : conversation.unread}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="moderation-note">
          <span aria-hidden="true">◇</span>
          <p><strong>Moderated space</strong>Ms. Fernandes can review reports.</p>
        </div>
      </aside>

      <section className="message-panel" aria-labelledby="conversation-title">
        <header className="message-header">
          <div>
            <h2 id="conversation-title">{activeConversation.name}</h2>
            <p>
              {activeConversation.kind === 'direct' && peerOnline
                ? 'Online'
                : activeConversation.detail}
              {' · Invite only'}
              {activeConversation.kind === 'direct' && realtimeConnected
                ? ' · Live'
                : ''}
            </p>
          </div>
          <div className="message-header__actions">
            {activeConversation.kind === 'direct' && call && (
              <CallExperience
                peerName={activeConversation.name}
                call={call}
                canCall={canCall}
              />
            )}
            <Dialog.Root>
              <Dialog.Trigger asChild>
                <button className="icon-button" type="button" aria-label="Conversation details">
                  i
                </button>
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className="dialog-overlay conversation-details__overlay" />
                <Dialog.Content className="conversation-details">
                  <div className="conversation-details__hero">
                    <Avatar initials={activeConversation.initials} tone="blue" />
                    <div>
                      <Dialog.Title>{activeConversation.name}</Dialog.Title>
                      <Dialog.Description>
                        {activeConversation.kind === 'direct'
                          ? peerOnline ? 'Online now' : 'Class member'
                          : activeConversation.detail}
                      </Dialog.Description>
                    </div>
                    <Dialog.Close asChild>
                      <button className="icon-button" type="button" aria-label="Close details">
                        ×
                      </button>
                    </Dialog.Close>
                  </div>
                  <dl className="conversation-details__facts">
                    <div>
                      <dt>Access</dt>
                      <dd>Invite-only classroom members</dd>
                    </div>
                    <div>
                      <dt>Privacy</dt>
                      <dd>Only participants can read this conversation</dd>
                    </div>
                    <div>
                      <dt>Safety</dt>
                      <dd>Use Report on a message to privately contact moderators</dd>
                    </div>
                  </dl>
                  {onToggleConversationMute && (
                    <button
                      className="settings-action"
                      type="button"
                      onClick={onToggleConversationMute}
                    >
                      {conversationMuted ? 'Turn notifications on' : 'Mute notifications'}
                    </button>
                  )}
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          </div>
        </header>

        <div className="classroom-reminder">
          <span aria-hidden="true">☼</span>
          <p>
            <strong>Remember our class agreement:</strong> be kind, protect personal
            information, and ask a moderator for help when something feels wrong.
          </p>
        </div>

        <div className="message-stream" aria-live="polite">
          <p className="date-divider"><span>Today</span></p>
          {messages.map((message) => {
            const isOwn = message.authorId === currentUser.id;
            return (
              <article className={isOwn ? 'message message--own' : 'message'} key={message.id}>
                {!isOwn && (
                  <Avatar
                    initials={message.initials}
                    tone={message.avatarTone || (message.moderator ? 'mint' : 'peach')}
                    size="small"
                  />
                )}
                <div className="message__content">
                  <p className="message__meta">
                    <strong>{isOwn ? 'You' : message.author}</strong>
                    {message.moderator && <span>Moderator</span>}
                    <time>{message.time}</time>
                  </p>
                  <div className="message__body">
                    <p className={
                      message.mentionedCurrentUser
                        ? 'message__bubble message__bubble--mentioned'
                        : 'message__bubble'
                    }>{message.text}</p>
                    {(onReact || (!isOwn && onReport)) && (
                      <div className="message-action-bar" aria-label="Message actions">
                        {onReact && (
                          <details className="reaction-picker">
                            <summary aria-label="Add reaction" title="Add reaction">
                              <ReactionIcon />
                            </summary>
                            <div className="reaction-picker__menu" role="menu" aria-label="Choose a reaction">
                              {['👍', '❤️', '😂', '😮', '😢', '👏'].map((emoji) => (
                                <button
                                  type="button"
                                  role="menuitem"
                                  key={emoji}
                                  onClick={(event) => {
                                    event.currentTarget.closest('details').removeAttribute('open');
                                    handleReaction(
                                      message.id,
                                      emoji,
                                      !message.reactions.some(
                                        (reaction) => reaction.emoji === emoji && reaction.mine,
                                      ),
                                    );
                                  }}
                                  aria-label={`React ${emoji}`}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </details>
                        )}
                        {!isOwn && onReport && (
                          <details className="message-options">
                            <summary aria-label="More message options" title="More options">
                              <MoreIcon />
                            </summary>
                            <div className="message-options__menu" role="menu">
                              <button
                                type="button"
                                role="menuitem"
                                onClick={(event) => {
                                  event.currentTarget.closest('details').removeAttribute('open');
                                  handleReport(message.id);
                                }}
                              >
                                <ReportIcon />
                                <span>
                                  <strong>Report message</strong>
                                  <small>Send privately to moderators</small>
                                </span>
                              </button>
                            </div>
                          </details>
                        )}
                      </div>
                    )}
                  </div>
                  {onReact && message.reactions.length > 0 && (
                    <div className="message-reactions" aria-label="Message reactions">
                      {message.reactions.map((reaction) => (
                        <button
                          type="button"
                          className={reaction.mine ? 'reaction-chip reaction-chip--mine' : 'reaction-chip'}
                          key={reaction.emoji}
                          onClick={() => handleReaction(
                            message.id,
                            reaction.emoji,
                            !reaction.mine,
                          )}
                          aria-label={`${reaction.emoji} ${reaction.count}`}
                        >
                          {reaction.emoji} {reaction.count}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <form className="composer" onSubmit={handleSend}>
          {notice && <p className="composer__notice" role="status">{notice}</p>}
          <label className="sr-only" htmlFor="message-draft">
            Message {activeConversation.name}
          </label>
          <div className="composer__row">
            <button className="attach-button" type="button" aria-label="Add attachment" disabled>
              +
            </button>
            <input
              id="message-draft"
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                setNotice('');
                updateTyping(event.target.value);
              }}
              placeholder={`Message ${activeConversation.name}`}
            />
            <button className="send-button" type="submit" disabled={sending}>
              {sending ? 'Sending…' : 'Send'}
            </button>
          </div>
          {mentionSuggestions.length > 0 && (
            <div className="mention-suggestions" role="listbox" aria-label="Mention a classmate">
              {mentionSuggestions.map((member) => (
                <button
                  type="button"
                  role="option"
                  key={member.id}
                  onClick={() => insertMention(member.name)}
                >
                  <Avatar initials={member.initials} tone="blue" size="small" />
                  <span><strong>{member.name}</strong><small>{member.role}</small></span>
                </button>
              ))}
            </div>
          )}
          <small>
            {peerTyping
              ? `${activeConversation.name} is typing…`
              : onSend
              ? 'Messages are visible only to authorized classroom members.'
              : 'Messages in this prototype are not sent or stored.'}
          </small>
        </form>
      </section>
    </section>
  );
}

export default ChatPanel;
