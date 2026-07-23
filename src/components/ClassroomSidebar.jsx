import Avatar from './Avatar';

function RailIcon({ name }) {
  const icons = {
    chat: 'M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-5 4v-4.5A2.5 2.5 0 0 1 4 12.5z',
    calls: 'M7 4l3 4-2 2c1.5 3 3 4.5 6 6l2-2 4 3-1 3c-.4 1.1-1.5 1.7-2.7 1.4C9.2 19.5 4.5 14.8 2.6 7.7 2.3 6.5 2.9 5.4 4 5z',
    notifications: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 8h18c0-1-3-1-3-8z M10 20h4',
    announcements: 'M4 11h3l9-5v12l-9-5H4z M7 13l1 6h3l-1-5',
    people: 'M16 19v-1.5A3.5 3.5 0 0 0 12.5 14h-5A3.5 3.5 0 0 0 4 17.5V19 M10 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M17 7a2.5 2.5 0 0 1 0 5 M18 14a3 3 0 0 1 2 3v2',
    more: 'M6 12h.01 M12 12h.01 M18 12h.01',
    moderation: 'M12 3l7 3v5c0 4.7-2.8 8-7 10-4.2-2-7-5.3-7-10V6z M12 8v5 M12 16h.01',
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={icons[name]} />
    </svg>
  );
}

const baseNavigation = [
  { id: 'chat', label: 'Chat' },
  { id: 'calls', label: 'Calls' },
  { id: 'notifications', label: 'Activity' },
  { id: 'people', label: 'People' },
  { id: 'more', label: 'More' },
];

function ClassroomSidebar({
  classroom,
  currentUser,
  activeView,
  onSelectView,
  onLeave,
  notificationCount = 0,
}) {
  const navigation =
    currentUser.role === 'Moderator'
      ? [...baseNavigation, { id: 'moderation', label: 'Moderation' }]
      : baseNavigation;
  return (
    <aside className="sidebar app-rail">
      <div className="app-rail__main">
        <button
          className="brand brand--inverse sidebar-brand"
          type="button"
          aria-label="Return to ChatClub messages"
          onClick={() => onSelectView('chat')}
        >
          <span className="brand-mark">C</span>
          <span>ChatClub</span>
        </button>
        <nav className="primary-nav" aria-label="Classroom">
          {navigation.map((item) => (
            <button
              className={
                activeView === item.id ||
                (item.id === 'more' && ['announcements', 'safety'].includes(activeView))
                  ? 'nav-button nav-button--active'
                  : 'nav-button'
              }
              key={item.id}
              type="button"
              onClick={() => onSelectView(item.id)}
              title={item.label}
            >
              <span className="nav-button__icon"><RailIcon name={item.id} /></span>
              <span className="nav-button__label">{item.label}</span>
              {item.id === 'notifications' && notificationCount > 0 && (
                <span className="nav-button__badge" aria-label={`${notificationCount} notifications`}>
                  {notificationCount > 99 ? '99+' : notificationCount}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>
      <div className="sidebar-profile">
        <Avatar
          initials={currentUser.initials}
          tone={currentUser.avatarTone || 'mint'}
          size="small"
        />
        <span className="sidebar-profile__copy">
          <strong>{currentUser.name}</strong>
          <small>{currentUser.role}</small>
        </span>
        <button type="button" onClick={onLeave} aria-label="Sign out" title="Sign out">
          ↗
        </button>
      </div>
    </aside>
  );
}

export default ClassroomSidebar;
