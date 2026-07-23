import Avatar from './Avatar';

import { useState } from 'react';

function CommunityPanel({ view, classroom, currentUserId, onMute, live = false }) {
  const [status, setStatus] = useState('');

  async function handleMute(member) {
    try {
      await onMute(member.id);
      setStatus(`${member.name} is muted for you.`);
    } catch (error) {
      setStatus(error.message);
    }
  }

  if (view === 'announcements') {
    return (
      <section className="content-panel">
        <span className="eyebrow">Teacher updates</span>
        <h1>Announcements</h1>
        <p className="content-panel__intro">Important information for the whole class.</p>
        <div className="announcement-grid">
          {classroom.announcements.map((announcement) => (
            <article className="content-card" key={announcement.id}>
              <p className="content-card__meta">{announcement.date} · {announcement.author}</p>
              <h2>{announcement.title}</h2>
              <p>{announcement.body}</p>
            </article>
          ))}
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
                <button className="member-action" type="button" onClick={() => handleMute(member)}>
                  Mute
                </button>
              )}
            </article>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="content-panel">
      <span className="eyebrow">Help is always available</span>
      <h1>Safety centre</h1>
      <p className="content-panel__intro">
        Classroom rules and reporting controls will be enforced by the secure backend
        in Milestone 2.
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
