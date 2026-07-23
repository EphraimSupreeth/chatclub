import Avatar from './Avatar';

import { useState } from 'react';

function CommunityPanel({
  view,
  classroom,
  currentUserId,
  onMute,
  onBlock,
  live = false,
}) {
  const [status, setStatus] = useState('');

  async function handleMute(member) {
    try {
      await onMute(member.id);
      setStatus(`${member.name} is muted for you.`);
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function handleBlock(member) {
    if (!window.confirm(`Block direct messages with ${member.name}?`)) return;
    try {
      await onBlock(member.id);
      setStatus(`${member.name} is blocked. Direct messages are disabled both ways.`);
    } catch (error) {
      setStatus(error.message);
    }
  }

  if (view === 'announcements') {
    return (
      <section className="content-panel updates-panel">
        <span className="eyebrow">Pinned conversation</span>
        <h1>Updates</h1>
        <p className="content-panel__intro">
          Read-only news shared with everyone in {classroom.name}.
        </p>
        <div className="updates-feed">
          {classroom.announcements.map((announcement) => (
            <article className="update-post" key={announcement.id}>
              <Avatar initials={announcement.author.slice(0, 2).toUpperCase()} tone="mint" />
              <div>
                <p className="content-card__meta">
                  <strong>{announcement.author}</strong> · {announcement.date}
                </p>
                <h2>{announcement.title}</h2>
                <p>{announcement.body}</p>
              </div>
            </article>
          ))}
          {classroom.announcements.length === 0 && (
            <p className="empty-copy">No updates have been posted.</p>
          )}
        </div>
      </section>
    );
  }

  if (view === 'members') {
    return (
      <section className="content-panel">
        <span className="eyebrow">Invite-only membership</span>
        <h1>Class members</h1>
        <p className="content-panel__intro">{classroom.members.length} people belong to this space.</p>
        {status && <p className="form-status" role="status">{status}</p>}
        <div className="member-list">
          {classroom.members.map((member, index) => (
            <article className="member-row" key={member.id}>
              <Avatar initials={member.initials} tone={index % 2 ? 'peach' : 'blue'} />
              <div>
                <h2>{member.name}</h2>
                <p>{member.role}</p>
              </div>
              <span className={member.online ? 'presence presence--online' : 'presence'}>
                {member.online ? 'Online' : 'Offline'}
              </span>
              {live && member.id !== currentUserId && (
                <div className="member-actions">
                  <button className="member-action" type="button" onClick={() => handleMute(member)}>
                    Mute
                  </button>
                  <button className="member-action member-action--danger" type="button" onClick={() => handleBlock(member)}>
                    Block
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="content-panel">
      <span className="eyebrow">Help when you need it</span>
      <h1>Safety</h1>
      <p className="content-panel__intro">
        Classroom rules are backed by reporting, blocking, rate limits, and moderator
        review.
      </p>
      <div className="safety-grid">
        <article className="content-card">
          <span className="card-icon">♡</span>
          <h2>Be respectful</h2>
          <p>Speak to classmates with the same care you would use face to face.</p>
        </article>
        <article className="content-card">
          <span className="card-icon">◇</span>
          <h2>Protect privacy</h2>
          <p>Do not share passwords, addresses, phone numbers, or private photos.</p>
        </article>
        <article className="content-card">
          <span className="card-icon">!</span>
          <h2>Report a concern</h2>
          <p>Use the Report action beside a message to send it privately to classroom moderators.</p>
        </article>
      </div>
    </section>
  );
}

export default CommunityPanel;
