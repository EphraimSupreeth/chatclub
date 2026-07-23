import Avatar from './Avatar';

function callDescription(call, currentUserId) {
  const outgoing = call.caller_id === currentUserId;
  const direction = outgoing ? 'Outgoing' : 'Incoming';
  const type = call.media_type === 'audio' ? 'audio' : 'video';
  const status = call.status === 'completed' ? '' : ` · ${call.status}`;
  return `${direction} ${type} call${status}`;
}

function callTime(value) {
  const date = new Date(value);
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function CallsPanel({
  calls = [],
  currentUserId,
  onOpenConversation,
}) {
  return (
    <section className="content-panel calls-panel" aria-labelledby="calls-title">
      <header className="calls-panel__header">
        <span className="eyebrow">Recent activity</span>
        <h1 id="calls-title">Calls</h1>
        <p className="content-panel__intro">
          Your private one-to-one audio and video call history.
        </p>
      </header>

      {calls.length === 0 ? (
        <div className="calls-empty">
          <span aria-hidden="true">⌁</span>
          <h2>No calls yet</h2>
          <p>Open a classmate’s chat to start an audio or video call.</p>
        </div>
      ) : (
        <div className="call-history-list">
          {calls.map((call) => {
            const outgoing = call.caller_id === currentUserId;
            const person = outgoing ? call.recipient : call.caller;
            const peerId = outgoing ? call.recipient_id : call.caller_id;
            return (
              <article className="call-history-row" key={call.id}>
                <Avatar initials={person?.avatar_initials || '?'} tone="blue" />
                <div className="call-history-row__copy">
                  <strong>{person?.display_name || 'Class member'}</strong>
                  <span className={`call-history-row__status call-history-row__status--${call.status}`}>
                    {callDescription(call, currentUserId)}
                  </span>
                </div>
                <time dateTime={call.started_at}>{callTime(call.started_at)}</time>
                <button
                  className="button button--secondary"
                  type="button"
                  onClick={() => onOpenConversation(peerId)}
                >
                  Open chat
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
