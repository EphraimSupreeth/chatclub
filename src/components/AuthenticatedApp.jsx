import { useCallback, useEffect, useState } from 'react';
import { getPlatformAccess, listClassrooms, signOut } from '../services/chatclubApi';
import ClassroomAccess from './ClassroomAccess';
import LiveClassroom from './LiveClassroom';

function AuthenticatedApp({ user }) {
  const [memberships, setMemberships] = useState([]);
  const [platformAccess, setPlatformAccess] = useState('student');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadClassrooms = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [nextMemberships, nextAccess] = await Promise.all([
        listClassrooms(),
        getPlatformAccess(),
      ]);
      setMemberships(nextMemberships);
      setPlatformAccess(nextAccess);
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
    return (
      <ClassroomAccess
        canCreate={['moderator', 'super_admin'].includes(platformAccess)}
        isSuperAdmin={platformAccess === 'super_admin'}
        onChanged={loadClassrooms}
        onSignOut={signOut}
      />
    );
  }

  return (
    <LiveClassroom
      membership={memberships[0]}
      platformAccess={platformAccess}
      user={user}
    />
  );
}

export default AuthenticatedApp;
