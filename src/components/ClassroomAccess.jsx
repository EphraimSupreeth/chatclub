import { useState } from 'react';
import { createClassroom, joinClassroom } from '../services/chatclubApi';
import PlatformAdminPanel from './PlatformAdminPanel';

function ClassroomAccess({ canCreate = false, isSuperAdmin = false, onChanged, onSignOut }) {
  const [mode, setMode] = useState('join');
  const [form, setForm] = useState({ code: '', name: '', schoolName: '' });
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setStatus('');
    try {
      if (mode === 'join') {
        await joinClassroom(form.code);
      } else {
        const created = await createClassroom(form);
        setStatus(`Class created. Save this invitation code: ${created.invite_code}`);
      }
      await onChanged();
    } catch (error) {
      setStatus(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="access-page">
      <section className="access-card">
        <span className="eyebrow">Invite-only access</span>
        <h1>{mode === 'join' ? 'Join a classroom' : 'Create a classroom'}</h1>
        <p>
          {mode === 'join'
            ? 'Enter the private code provided by your class moderator.'
            : 'The creator becomes the first classroom moderator.'}
        </p>
        <form onSubmit={handleSubmit}>
          {mode === 'join' ? (
            <>
              <label htmlFor="access-code">Class code</label>
              <input id="access-code" name="code" value={form.code} onChange={updateField} required />
            </>
          ) : (
            <>
              <label htmlFor="class-name">Class name</label>
              <input id="class-name" name="name" value={form.name} onChange={updateField} required />
              <label htmlFor="school-name">School name</label>
              <input id="school-name" name="schoolName" value={form.schoolName} onChange={updateField} required />
            </>
          )}
          {status && <p className="form-status" role="status">{status}</p>}
          <button className="button button--primary" type="submit" disabled={submitting}>
            {submitting ? 'Please wait…' : mode === 'join' ? 'Join classroom' : 'Create classroom'}
          </button>
        </form>
        {canCreate && (
          <button className="text-button" type="button" onClick={() => setMode(mode === 'join' ? 'create' : 'join')}>
            {mode === 'join' ? 'Create a classroom' : 'Have a code? Join a class'}
          </button>
        )}
        {!canCreate && (
          <p className="access-note">
            Classroom creation is restricted to moderators approved by a super-admin.
          </p>
        )}
        <button className="text-button text-button--muted" type="button" onClick={onSignOut}>Sign out</button>
      </section>
      {isSuperAdmin && <PlatformAdminPanel />}
    </main>
  );
}

export default ClassroomAccess;
