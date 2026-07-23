import { useMemo, useState } from 'react';
import Avatar from './Avatar';

export default function PeoplePanel({
  members,
  currentUserId,
  availableUserIds = [],
  onOpenConversation,
}) {
  const [query, setQuery] = useState('');
  const filteredMembers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return members
      .filter((member) => member.id !== currentUserId)
      .filter((member) =>
        !normalized ||
        member.name.toLowerCase().includes(normalized) ||
        member.role.toLowerCase().includes(normalized));
  }, [currentUserId, members, query]);

  return (
    <section className="content-panel people-panel" aria-labelledby="people-title">
      <header className="people-panel__header">
        <span className="eyebrow">Your private community</span>
        <h1 id="people-title">People</h1>
        <p className="content-panel__intro">
          Find a classmate and continue the conversation.
        </p>
        <label className="people-search">
          <span className="sr-only">Search people</span>
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            aria-label="Search people"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search people"
          />
        </label>
      </header>

      <div className="people-list">
        {filteredMembers.map((member, index) => {
          const available = availableUserIds.includes(member.id);
          return (
            <article className="person-card" key={member.id}>
              <div className="person-card__identity">
                <div className="person-card__avatar">
                  <Avatar
                    initials={member.initials}
                    tone={member.avatarTone || (index % 2 ? 'peach' : 'blue')}
                  />
                  {available && <span className="person-card__presence" aria-label="Available" />}
                </div>
                <div>
                  <h2>{member.name}</h2>
                  <p>{available ? 'Available now' : member.role}</p>
                </div>
              </div>
              <button
                className="button button--primary"
                type="button"
                onClick={() => onOpenConversation(member.id)}
              >
                Message
              </button>
            </article>
          );
        })}
        {filteredMembers.length === 0 && (
          <div className="people-empty">
            <h2>No matching people</h2>
            <p>Try searching with a different name.</p>
          </div>
        )}
      </div>
    </section>
  );
}
