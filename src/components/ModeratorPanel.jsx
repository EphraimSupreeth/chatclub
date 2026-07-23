import { useEffect, useState } from 'react';
import {
  listModeratorData,
  removeClassroomMember,
  resolveReport,
  rotateClassroomInvite,
} from '../services/chatclubApi';

const actionLabels = {
  report_created: 'Report submitted',
  report_reviewed: 'Report status changed',
  member_removed: 'Member removed',
  invite_rotated: 'Invitation code rotated',
};

function ModeratorPanel({ classroom, currentUserId, onClassroomChanged }) {
  const [data, setData] = useState({ reports: [], auditEvents: [] });
  const [status, setStatus] = useState('Loading moderation queue…');
  const [inviteCode, setInviteCode] = useState('');

  async function loadData() {
    try {
      setData(await listModeratorData(classroom.id));
      setStatus('');
    } catch (error) {
      setStatus(error.message);
    }
  }

  useEffect(() => {
    loadData();
  }, [classroom.id]);

  async function changeReport(reportId, resolution) {
    try {
      await resolveReport(reportId, resolution);
      setStatus(`Report marked ${resolution}.`);
      await loadData();
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function removeMember(member) {
    if (!window.confirm(`Remove ${member.name} from this classroom?`)) return;
    try {
      const replacementCode = await removeClassroomMember(classroom.id, member.id);
      setInviteCode(replacementCode);
      setStatus(`${member.name} was removed. Copy the replacement invitation code now.`);
      await onClassroomChanged();
      await loadData();
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function rotateInvite() {
    if (!window.confirm('Rotate the invitation code? The previous code will stop working.')) return;
    try {
      const code = await rotateClassroomInvite(classroom.id);
      setInviteCode(code);
      setStatus('Invitation code rotated. Copy it now; it will not be shown again.');
      await loadData();
    } catch (error) {
      setStatus(error.message);
    }
  }

  return (
    <section className="content-panel moderation-panel">
      <span className="eyebrow">Moderator access</span>
      <h1>Moderation</h1>
      <p className="content-panel__intro">
        Review reports, control membership, and audit important safety actions.
      </p>
      {status && <p className="form-status" role="status">{status}</p>}

      <section className="moderation-section" aria-labelledby="reports-title">
        <div className="moderation-heading">
          <div>
            <h2 id="reports-title">Reports</h2>
            <p>{data.reports.filter((report) => report.status === 'open').length} open</p>
          </div>
        </div>
        <div className="report-list">
          {data.reports.length === 0 ? (
            <p className="empty-copy">No reports have been submitted.</p>
          ) : (
            data.reports.map((report) => (
              <article className="report-card" key={report.id}>
                <div className="report-card__header">
                  <strong>{report.message?.sender?.display_name ?? 'Deleted message'}</strong>
                  <span className={`status-pill status-pill--${report.status}`}>{report.status}</span>
                </div>
                {report.message?.body && <blockquote>{report.message.body}</blockquote>}
                <p><strong>Reason:</strong> {report.reason}</p>
                <small>
                  Reported by {report.reporter?.display_name ?? 'Unknown member'} ·{' '}
                  {new Date(report.created_at).toLocaleString()}
                </small>
                <div className="report-actions">
                  <button type="button" onClick={() => changeReport(report.id, 'reviewing')}>Reviewing</button>
                  <button type="button" onClick={() => changeReport(report.id, 'resolved')}>Resolve</button>
                  <button type="button" onClick={() => changeReport(report.id, 'dismissed')}>Dismiss</button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="moderation-section" aria-labelledby="membership-title">
        <div className="moderation-heading">
          <div>
            <h2 id="membership-title">Membership</h2>
            <p>Remove access when a member leaves the class.</p>
          </div>
          <button className="button button--secondary" type="button" onClick={rotateInvite}>
            Rotate invitation code
          </button>
        </div>
        {inviteCode && (
          <div className="invite-result">
            <strong>{inviteCode}</strong>
            <button type="button" onClick={() => navigator.clipboard.writeText(inviteCode)}>Copy</button>
          </div>
        )}
        <div className="compact-member-list">
          {classroom.members.map((member) => (
            <div key={member.id}>
              <span><strong>{member.name}</strong><small>{member.role}</small></span>
              {member.id !== currentUserId && (
                <button type="button" onClick={() => removeMember(member)}>Remove</button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="moderation-section" aria-labelledby="audit-title">
        <div className="moderation-heading">
          <div>
            <h2 id="audit-title">Audit trail</h2>
            <p>Recent safety-sensitive actions. Retained for 365 days.</p>
          </div>
        </div>
        <div className="audit-list">
          {data.auditEvents.map((event) => (
            <p key={event.id}>
              <strong>{actionLabels[event.action] ?? event.action}</strong>
              <span>{event.actor?.display_name ?? 'System'} · {new Date(event.created_at).toLocaleString()}</span>
            </p>
          ))}
          {data.auditEvents.length === 0 && <p className="empty-copy">No audit events yet.</p>}
        </div>
      </section>
    </section>
  );
}

export default ModeratorPanel;
