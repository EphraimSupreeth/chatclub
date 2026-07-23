function SetupScreen({ onViewDemo }) {
  return (
    <main className="setup-page">
      <section className="setup-card">
        <span className="brand-mark">C</span>
        <span className="eyebrow">Backend setup required</span>
        <h1>Connect ChatClub to Supabase</h1>
        <p>
          Milestone 2 is ready for secure accounts and persistent messaging, but this
          environment does not have backend credentials yet.
        </p>
        <ol>
          <li>Create a Supabase project.</li>
          <li>Run <code>supabase/migrations/001_chatclub_mvp.sql</code>.</li>
          <li>Copy <code>.env.example</code> to <code>.env.local</code> and add the project URL and publishable key.</li>
          <li>Restart the development server.</li>
        </ol>
        <button className="button button--primary" type="button" onClick={onViewDemo}>
          View interface demo
        </button>
      </section>
    </main>
  );
}

export default SetupScreen;
