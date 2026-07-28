import { useEffect, useState } from 'react';
import {
  grantPlatformModerator,
  listPlatformModerators,
  revokePlatformModerator,
  setClassroomModerator,
} from '../services/chatclubApi';

function PlatformAdminPanel({ classroomId = null, classroomModeratorIds = [], onChanged }) {
  const [staff, setStaff] = useState([]);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('Loading staff access…');
  const [submitting, setSubmitting] = useState(false);

  async function loadStaff() {
    try {
      setStaff(await listPlatformModerators());
      setStatus('');
    } catch (error) {
      setStatus(error.message);
    }
  }

  useEffect(() => {
    loadStaff();
  }, []);

  async function grant(event) {
    event.preventDefault();
    setSubmitting(true);
    setStatus('');
    try {
      await grantPlatformModerator(email);
      setEmail('');
      setStatus('Moderator access granted.');
      await loadStaff();
    } catch (error) {
      setStatus(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function revoke(member) {
    if (!window.confirm(
      `Revoke moderator access for ${member.display_name}? They will lose moderator classroom memberships.`,
    )) return;
    try {
      await revokePlatformModerator(member.user_id);
      setStatus('Moderator access revoked.');
      await loadStaff();
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function toggleClassroom(member) {
    const assigned = classroomModeratorIds.includes(member.user_id);
    try {
      await setClassroomModerator(classroomId, member.user_id, !assigned);
      setStatus(
        assigned
          ? 'Classroom moderator assignment removed.'
          : 'Moderator assigned to this classroom.',
      );
      await onChanged?.();
    } catch (error) {
      setStatus(error.message);
    }
  }

  return (
    <section className="access-card platform-admin" aria-labelledby="staff-access-title">
      <span className="eyebrow">Super-admin only</span>
      <h1 id="staff-access-title">Staff access</h1>
      <p>Grant moderator privileges only after independently verifying the person.</p>
      <form onSubmit={grant}>
        <label htmlFor="moderator-email">Confirmed ChatClub account email</label>
        <input
          id="moderator-email"
          type="email"
          autoComplete="off"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <button className="button button--primary" type="submit" disabled={submitting}>
          {submitting ? 'Granting…' : 'Grant moderator access'}
        </button>
      </form>
      {status && <p className="form-status" role="status">{status}</p>}
      <div className="staff-access-list">
        {staff.map((member) => (
          <div key={member.user_id}>
            <span>
              <strong>{member.display_name}</strong>
              <small>{member.email} · {member.role.replace('_', ' ')}</small>
            </span>
            {member.role === 'moderator' && (
              <span className="staff-access-actions">
                {classroomId && (
                  <button type="button" onClick={() => toggleClassroom(member)}>
                    {classroomModeratorIds.includes(member.user_id)
                      ? 'Remove from class'
                      : 'Assign to class'}
                  </button>
                )}
                <button type="button" onClick={() => revoke(member)}>Revoke staff access</button>
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export default PlatformAdminPanel;
