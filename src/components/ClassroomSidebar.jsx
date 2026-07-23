import Avatar from './Avatar';

const baseNavigation = [
  { id: 'chat', label: 'Messages', icon: '✦' },
  { id: 'announcements', label: 'Announcements', icon: '◉' },
  { id: 'members', label: 'Class members', icon: '◎' },
  { id: 'safety', label: 'Safety centre', icon: '◇' },
];

function ClassroomSidebar({
  classroom,
  currentUser,
  activeView,
  onSelectView,
  onLeave,
}) {
  const navigation =
    currentUser.role === 'Moderator'
      ? [...baseNavigation, { id: 'moderation', label: 'Moderation', icon: '⚑' }]
      : baseNavigation;
  return (
    <aside className="sidebar">
      <div>
        <button
          className="brand brand--inverse sidebar-brand"
          type="button"
          aria-label="Return to ChatClub messages"
          onClick={() => onSelectView('chat')}
        >
          <span className="brand-mark">C</span>
          <span>ChatClub</span>
        </button>
        <div className="class-summary">
          <span className="class-summary__label">Your classroom</span>
          <strong>{classroom.name}</strong>
          <span>{classroom.school}</span>
        </div>
        <nav className="primary-nav" aria-label="Classroom">
          {navigation.map((item) => (
            <button
              className={activeView === item.id ? 'nav-button nav-button--active' : 'nav-button'}
              key={item.id}
              type="button"
              onClick={() => onSelectView(item.id)}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="sidebar-profile">
        <Avatar initials={currentUser.initials} tone="mint" size="small" />
        <span>
          <strong>{currentUser.name}</strong>
          <small>{currentUser.role}</small>
        </span>
        <button type="button" onClick={onLeave} aria-label="Leave demo">↗</button>
      </div>
    </aside>
  );
}

export default ClassroomSidebar;
