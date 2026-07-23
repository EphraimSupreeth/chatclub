import { useState } from 'react';
import { signIn, signUp } from '../services/chatclubApi';

function AuthScreen() {
  const [mode, setMode] = useState('signin');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [status, setStatus] = useState({ type: '', message: '' });
  const [submitting, setSubmitting] = useState(false);

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    setStatus({ type: '', message: '' });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setStatus({ type: '', message: '' });
    try {
      if (mode === 'signup') {
        await signUp(form);
        setStatus({
          type: 'success',
          message: 'Account created. Check your email if confirmation is enabled.',
        });
      } else {
        await signIn(form);
      }
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-copy">
        <a className="brand brand--large" href="/" aria-label="ChatClub home">
          <span className="brand-mark">C</span>
          <span>ChatClub</span>
        </a>
        <span className="eyebrow">Private classroom community</span>
        <h1>Your class conversations belong to your class.</h1>
        <p>Membership requires an invitation code, and every classroom has a moderator.</p>
      </section>
      <section className="auth-card" aria-labelledby="auth-title">
        <h2 id="auth-title">{mode === 'signin' ? 'Welcome back' : 'Create your account'}</h2>
        <p>{mode === 'signin' ? 'Sign in to enter your classrooms.' : 'Use your real first and last name.'}</p>
        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <>
              <label htmlFor="auth-name">Full name</label>
              <input id="auth-name" name="name" value={form.name} onChange={updateField} required />
            </>
          )}
          <label htmlFor="auth-email">Email</label>
          <input id="auth-email" name="email" type="email" value={form.email} onChange={updateField} required />
          <label htmlFor="auth-password">Password</label>
          <input id="auth-password" name="password" type="password" minLength="8" value={form.password} onChange={updateField} required />
          {status.message && <p className={`form-status form-status--${status.type}`} role="status">{status.message}</p>}
          <button className="button button--primary" type="submit" disabled={submitting}>
            {submitting ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>
        <button
          className="text-button"
          type="button"
          onClick={() => setMode((current) => (current === 'signin' ? 'signup' : 'signin'))}
        >
          {mode === 'signin' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
        </button>
      </section>
    </main>
  );
}

export default AuthScreen;
