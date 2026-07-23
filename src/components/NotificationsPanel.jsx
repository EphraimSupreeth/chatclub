import Avatar from './Avatar';

function notificationTime(value) {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function NotificationsPanel({ notifications, onOpen }) {
  return (
    <section className="content-panel notifications-panel" aria-labelledby="notifications-title">
      <header>
        <span className="eyebrow">Private activity</span>
        <h1 id="notifications-title">Notifications</h1>
        <p className="content-panel__intro">
          Mentions, unread chats and missed calls. Message text is not repeated here.
        </p>
      </header>
      {notifications.length === 0 ? (
        <div className="notifications-empty">
          <span aria-hidden="true">✓</span>
          <h2>You’re caught up</h2>
          <p>New activity will appear here without exposing message previews.</p>
        </div>
      ) : (
        <div className="notification-list">
          {notifications.map((notification) => (
            <button
              type="button"
              className="notification-row"
              key={notification.id}
              onClick={() => onOpen(notification)}
            >
              <Avatar
                initials={notification.initials}
                tone={notification.tone || 'blue'}
              />
              <span>
                <strong>{notification.title}</strong>
                <small>{notification.description}</small>
              </span>
              <time dateTime={notification.createdAt}>
                {notificationTime(notification.createdAt)}
              </time>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
