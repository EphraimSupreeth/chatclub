import { useState } from 'react';

function JoinScreen({ onEnter }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(event) {
    event.preventDefault();
    if (!code.trim()) {
      setError('Enter the private class code provided by your moderator.');
      return;
    }
    setError('');
    onEnter();
  }

  return (
    <main className="join-page">
      <section className="join-intro" aria-labelledby="welcome-title">
        <a className="brand brand--large" href="/" aria-label="ChatClub home">
          <span className="brand-mark">C</span>
          <span>ChatClub</span>
        </a>
        <p className="eyebrow">Private by design</p>
        <h1 id="welcome-title">A calmer place for your class to connect.</h1>
        <p className="join-lead">
          Invite-only conversations, clear classroom rules, and moderators who can
          help keep everyone safe.
        </p>
        <div className="trust-list" aria-label="Community features">
          <p><span>✓</span> Only invited classmates can join</p>
          <p><span>✓</span> Teachers and class admins moderate the space</p>
          <p><span>✓</span> Members can mute, block, or report concerns</p>
        </div>
      </section>

      <section className="join-card" aria-labelledby="join-title">
        <span className="prototype-badge">Milestone 1 prototype</span>
        <h2 id="join-title">Join your classroom</h2>
        <p>Use the private code shared by your teacher or class admin.</p>
        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor="class-code">Class code</label>
          <input
            id="class-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="e.g. DEMO-10A"
            autoComplete="off"
            aria-describedby={error ? 'class-code-error' : undefined}
          />
          {error && <p className="field-error" id="class-code-error">{error}</p>}
          <button className="button button--primary" type="submit">
            Enter class demo
          </button>
        </form>
        <p className="demo-note">
          This milestone uses demo data only. Secure accounts and real invitations
          arrive with the Milestone 2 backend.
        </p>
      </section>
    </main>
  );
}

export default JoinScreen;
