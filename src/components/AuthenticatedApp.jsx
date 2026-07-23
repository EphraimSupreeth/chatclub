import { useCallback, useEffect, useState } from 'react';
import { listClassrooms, signOut } from '../services/chatclubApi';
import ClassroomAccess from './ClassroomAccess';
import LiveClassroom from './LiveClassroom';

function AuthenticatedApp({ user }) {
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadClassrooms = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setMemberships(await listClassrooms());
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClassrooms();
  }, [loadClassrooms]);

  if (loading) return <main className="loading-page"><p>Loading your classrooms…</p></main>;
  if (error) return <main className="loading-page"><p>{error}</p><button className="button button--secondary" onClick={loadClassrooms}>Try again</button></main>;
  if (memberships.length === 0) {
    return <ClassroomAccess onChanged={loadClassrooms} onSignOut={signOut} />;
  }

  return <LiveClassroom membership={memberships[0]} user={user} />;
}

export default AuthenticatedApp;
