import { useState } from 'react';
import Avatar from './Avatar';

function ChatPanel({
  classroom,
  currentUser,
  conversations,
  activeConversation,
  messages,
  onSelectConversation,
  onSend,
  onReport,
}) {
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState('');
  const [sending, setSending] = useState(false);

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

  return (
    <section className="chat-layout" aria-label="Messages">
      <aside className="conversation-list">
        <div className="conversation-list__header">
          <span className="eyebrow">Classroom</span>
          <h1>Messages</h1>
          <p>Private conversations with your class.</p>
        </div>
        <div className="conversation-items">
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
                tone={index % 2 === 0 ? 'blue' : 'peach'}
              />
              <span className="conversation-card__copy">
                <strong>{conversation.name}</strong>
                <small>{conversation.detail}</small>
              </span>
              {conversation.unread > 0 && (
                <span className="unread-count" aria-label={`${conversation.unread} unread`}>
                  {conversation.unread}
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
            <p>{activeConversation.detail} · Invite only</p>
          </div>
          <button className="icon-button" type="button" aria-label="Conversation information">
            i
          </button>
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
                    tone={message.moderator ? 'mint' : 'peach'}
                    size="small"
                  />
                )}
                <div className="message__content">
                  <p className="message__meta">
                    <strong>{isOwn ? 'You' : message.author}</strong>
                    {message.moderator && <span>Moderator</span>}
                    <time>{message.time}</time>
                  </p>
                  <p className="message__bubble">{message.text}</p>
                  {!isOwn && onReport && (
                    <button
                      className="message__action"
                      type="button"
                      onClick={() => handleReport(message.id)}
                    >
                      Report
                    </button>
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
              }}
              placeholder={`Message ${activeConversation.name}`}
            />
            <button className="send-button" type="submit" disabled={sending}>
              {sending ? 'Sending…' : 'Send'}
            </button>
          </div>
          <small>
            {onSend
              ? 'Messages are visible only to authorized classroom members.'
              : 'Messages in this prototype are not sent or stored.'}
          </small>
        </form>
      </section>
    </section>
  );
}

export default ChatPanel;
